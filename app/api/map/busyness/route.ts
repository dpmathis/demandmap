import { NextRequest, NextResponse } from "next/server";
import { getStationBusynessInBBox } from "@/app/lib/db/spatial";
import { getStationArrivals } from "@/app/lib/gtfs-rt";
import { computeBusyness } from "@/app/lib/busyness";
import { requireAuth } from "@/app/lib/auth-guard";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const sp = req.nextUrl.searchParams;
  const west = parseFloat(sp.get("west") ?? "");
  const south = parseFloat(sp.get("south") ?? "");
  const east = parseFloat(sp.get("east") ?? "");
  const north = parseFloat(sp.get("north") ?? "");

  if ([west, south, east, north].some(isNaN)) {
    return NextResponse.json({ error: "Missing bbox params" }, { status: 400 });
  }

  // Current NYC time for day-of-week and hour
  const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dayOfWeek = now.getDay(); // 0=Sun
  const hour = now.getHours();

  // Fetch historical baseline and real-time arrivals in parallel
  const [rows, arrivals] = await Promise.all([
    getStationBusynessInBBox({ west, south, east, north }, dayOfWeek, hour),
    getStationArrivals().catch(() => new Map<string, number>()),
  ]);

  const geojson = {
    type: "FeatureCollection" as const,
    features: rows.map((r) => ({
      type: "Feature" as const,
      geometry: JSON.parse(r.geojson),
      properties: {
        id: r.id,
        name: r.name,
        lines: r.lines,
        avgRidership: r.avgRidership,
        busynessScore: computeBusyness(
          r.baselinePctile ?? 0,
          r.stationComplexId ? (arrivals.get(r.stationComplexId) ?? 0) : 0,
        ),
      },
    })),
  };

  return NextResponse.json(geojson);
}
