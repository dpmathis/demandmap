import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requireAuth } from "@/app/lib/auth-guard";

export const revalidate = 3600; // cache 1hr

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  // Citywide average demand score per time window.
  // This serves as the "typical" baseline for computing deltas.
  const rows = await prisma.blockHourlyDemand.groupBy({
    by: ["timeWindow"],
    _avg: { demandScore: true },
  });

  const windows: Record<string, number> = {};
  for (const r of rows) {
    if (r._avg.demandScore != null) {
      windows[r.timeWindow] = r._avg.demandScore;
    }
  }

  return NextResponse.json(
    { windows },
    {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
    }
  );
}
