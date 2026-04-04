import { NextRequest, NextResponse } from "next/server";
import { getCompetitorsInBBox } from "@/app/lib/db/spatial";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const west = parseFloat(p.get("west") || "");
  const south = parseFloat(p.get("south") || "");
  const east = parseFloat(p.get("east") || "");
  const north = parseFloat(p.get("north") || "");

  if ([west, south, east, north].some(isNaN)) {
    return NextResponse.json({ error: "Missing bbox" }, { status: 400 });
  }

  const data = await getCompetitorsInBBox({ west, south, east, north });
  return NextResponse.json(data);
}
