import { NextRequest, NextResponse } from "next/server";
import { getCompetitorsInBBox, VERTICAL_COMPETITOR_CATEGORIES, type CompetitorFilters } from "@/app/lib/db/spatial";
import { requireAuth } from "@/app/lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const p = request.nextUrl.searchParams;
  const west = parseFloat(p.get("west") || "");
  const south = parseFloat(p.get("south") || "");
  const east = parseFloat(p.get("east") || "");
  const north = parseFloat(p.get("north") || "");

  if ([west, south, east, north].some(isNaN)) {
    return NextResponse.json({ error: "Missing bbox" }, { status: 400 });
  }

  // Resolve vertical → competitor categories. Empty array = no known competitors
  // for this vertical; short-circuit to empty FeatureCollection.
  const vertical = p.get("vertical");
  if (vertical && vertical in VERTICAL_COMPETITOR_CATEGORIES) {
    const cats = VERTICAL_COMPETITOR_CATEGORIES[vertical];
    if (cats.length === 0) {
      return NextResponse.json({ type: "FeatureCollection", features: [] });
    }
  }

  const filters: CompetitorFilters = {};
  const tiers = p.get("tiers");
  if (tiers) filters.tiers = tiers.split(",").filter(Boolean);
  const chainFilter = p.get("chainFilter");
  if (chainFilter === "chain" || chainFilter === "independent") filters.chainFilter = chainFilter;
  if (vertical && vertical in VERTICAL_COMPETITOR_CATEGORIES) {
    filters.categories = VERTICAL_COMPETITOR_CATEGORIES[vertical];
  }

  const data = await getCompetitorsInBBox({ west, south, east, north }, filters);
  return NextResponse.json(data);
}
