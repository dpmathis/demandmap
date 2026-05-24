import { NextRequest, NextResponse } from "next/server";
import { getStationsInBBox } from "@/app/lib/db/spatial";
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

  const geojson = await getStationsInBBox({ west, south, east, north });
  // Subway stations don't move. Cache aggressively at the edge so repeat map
  // pans don't re-query Neon.
  return NextResponse.json(geojson, {
    headers: {
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400",
    },
  });
}
