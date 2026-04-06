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
  return NextResponse.json(geojson);
}
