import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";
import { Prisma } from "@prisma/client";
import { getRouteSuggestion } from "@/app/lib/ai";
import { DEFAULT_TIME_WINDOW } from "@/app/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: routeId } = await params;

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "AI suggestions require an ANTHROPIC_API_KEY" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const route = await prisma.route.findFirst({
    where: { id: routeId, tenantId: tu.tenantId },
    include: {
      stops: {
        orderBy: { sortOrder: "asc" },
        include: { censusBlock: { select: { ntaName: true, borough: true } } },
      },
    },
  });
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const timeWindow = (body.timeWindow as string) ?? DEFAULT_TIME_WINDOW;

  // Get top candidate blocks by demand for the given time window
  const existingGeoids = route.stops.map((s) => s.censusBlockGeoid);
  const excludeList = existingGeoids.length ? existingGeoids : ["__none__"];

  const topBlockRows = await prisma.$queryRaw<
    Array<{
      geoid: string;
      nta_name: string | null;
      borough: string | null;
      demand_score: number | null;
      composite_score: number | null;
      total_jobs: number | null;
      nearest_subway_meters: number | null;
      specialty_count_500m: number | null;
      centroid_lng: number | null;
      centroid_lat: number | null;
    }>
  >`
    SELECT
      cb.geoid,
      cb.nta_name,
      cb.borough,
      bhd.demand_score,
      os.composite_score,
      cb.total_jobs,
      cb.nearest_subway_meters,
      os.specialty_count_500m,
      ST_X(ST_Centroid(cb.geom)) as centroid_lng,
      ST_Y(ST_Centroid(cb.geom)) as centroid_lat
    FROM census_blocks cb
    LEFT JOIN block_hourly_demand bhd
      ON cb.geoid = bhd.census_block_geoid AND bhd.time_window = ${timeWindow}
    LEFT JOIN opportunity_scores os
      ON cb.geoid = os.census_block_geoid
    WHERE cb.geom IS NOT NULL
      AND bhd.demand_score IS NOT NULL
      AND cb.geoid NOT IN (${Prisma.join(excludeList)})
    ORDER BY bhd.demand_score DESC NULLS LAST
    LIMIT 10
  `;

  // Fetch weather
  let weather = null;
  try {
    const w = await fetch(
      "https://api.open-meteo.com/v1/forecast?latitude=40.7128&longitude=-74.006&current=temperature_2m,wind_speed_10m,precipitation,weather_code&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York"
    ).then((r) => r.json());
    if (w.current) {
      weather = {
        temp: Math.round(w.current.temperature_2m),
        description: getWeatherDesc(w.current.weather_code),
        windSpeed: Math.round(w.current.wind_speed_10m),
        precipitation: w.current.precipitation ?? 0,
      };
    }
  } catch { /* silent */ }

  const currentStops = route.stops.map((s) => ({
    geoid: s.censusBlockGeoid,
    ntaName: s.censusBlock?.ntaName ?? null,
    borough: s.censusBlock?.borough ?? null,
    timeWindow: s.timeWindow,
    demandScore: null,
  }));

  const topBlocks = topBlockRows.map((b) => ({
    geoid: b.geoid,
    ntaName: b.nta_name,
    borough: b.borough,
    demandScore: b.demand_score,
    compositeScore: b.composite_score,
    totalJobs: b.total_jobs,
    nearestSubwayMeters: b.nearest_subway_meters,
    specialtyCount500m: b.specialty_count_500m,
    centroidLng: b.centroid_lng,
    centroidLat: b.centroid_lat,
  }));

  try {
    const suggestion = await getRouteSuggestion({
      vertical: route.vertical,
      currentStops,
      topBlocks,
      weather,
      timeWindow,
    });

    // Attach centroid coordinates from the candidate block
    const matchedBlock = topBlockRows.find((b) => b.geoid === suggestion.geoid);
    const enriched = {
      ...suggestion,
      centroidLat: matchedBlock?.centroid_lat ?? null,
      centroidLng: matchedBlock?.centroid_lng ?? null,
    };

    return NextResponse.json({ suggestion: enriched });
  } catch (err) {
    console.error("AI suggestion error:", err);
    return NextResponse.json({ error: "AI suggestion failed" }, { status: 500 });
  }
}

function getWeatherDesc(code: number): string {
  if (code === 0) return "clear sky";
  if (code <= 3) return "partly cloudy";
  if (code <= 49) return "foggy";
  if (code <= 67) return "rainy";
  if (code <= 77) return "snowy";
  if (code <= 82) return "showers";
  if (code <= 99) return "thunderstorm";
  return "unknown";
}
