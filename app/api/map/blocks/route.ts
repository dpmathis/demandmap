import { NextRequest, NextResponse } from "next/server";
import { getBlocksInBBox } from "@/app/lib/db/spatial";

export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const west = parseFloat(p.get("west") || "");
  const south = parseFloat(p.get("south") || "");
  const east = parseFloat(p.get("east") || "");
  const north = parseFloat(p.get("north") || "");
  const timeWindow = p.get("timeWindow") || "09-11";

  if ([west, south, east, north].some(isNaN)) {
    return NextResponse.json({ error: "Missing bbox" }, { status: 400 });
  }

  const data = await getBlocksInBBox({ west, south, east, north }, timeWindow);
  return NextResponse.json(data);
}
