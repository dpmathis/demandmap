import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { TIME_WINDOWS, type TimeWindow } from "@/app/lib/constants";

/**
 * Returns today's top-scoring demand block for the current time-of-day window.
 *
 * Intentionally PUBLIC (no auth) — this is what the iOS Widget Extension
 * polls every ~30 min. Data is city-wide, not user-specific, so there's no
 * tenant or PII to protect. Cached at the edge to keep hits cheap.
 */

function getCurrentTimeWindow(): TimeWindow {
  const hour = new Date().toLocaleString("en-US", {
    hour: "numeric",
    hour12: false,
    timeZone: "America/New_York",
  });
  const h = parseInt(hour, 10);

  for (const tw of TIME_WINDOWS) {
    const [start, end] = tw.split("-").map(Number);
    if (h >= start && h < end) return tw;
  }
  // Outside the configured windows — fall back to the first morning window
  return TIME_WINDOWS[0];
}

export async function GET() {
  const currentWindow = getCurrentTimeWindow();

  const rows = await prisma.$queryRawUnsafe<
    Array<{ nta_name: string | null; borough: string | null; demand_score: number }>
  >(
    `
    SELECT cb.nta_name, cb.borough, bhd.demand_score
    FROM block_hourly_demand bhd
    JOIN census_blocks cb ON cb.geoid = bhd.census_block_geoid
    WHERE bhd.time_window = $1 AND cb.nta_name IS NOT NULL
    ORDER BY bhd.demand_score DESC
    LIMIT 1
    `,
    currentWindow,
  );

  const top = rows[0];
  if (!top) {
    return NextResponse.json(
      { topBlock: null, timeWindow: currentWindow },
      { headers: { "Cache-Control": "public, s-maxage=300" } },
    );
  }

  return NextResponse.json(
    {
      topBlock: {
        ntaName: top.nta_name,
        borough: top.borough ?? "",
        score: Math.round(top.demand_score),
        timeWindow: currentWindow,
      },
      asOf: new Date().toISOString(),
    },
    {
      headers: {
        // 15 min edge cache + 30 min SWR — widget polls every 30 min, so this
        // gives one fresh fetch per cycle without hammering Neon.
        "Cache-Control": "public, s-maxage=900, stale-while-revalidate=1800",
      },
    },
  );
}
