import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requireAuth } from "@/app/lib/auth-guard";

export async function GET(request: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const p = request.nextUrl.searchParams;
  const timeWindow = p.get("timeWindow") || "09-11";

  const rows = await prisma.$queryRaw<
    Array<{
      nta_code: string;
      nta_name: string;
      borough: string;
      total_blocks: number | null;
      avg_demand: number | null;
      avg_gap: number | null;
      avg_composite: number | null;
      total_competitors: number | null;
      centroid_lng: number | null;
      centroid_lat: number | null;
    }>
  >`
    SELECT
      nb.nta_code,
      nb.nta_name,
      nb.borough,
      nb.total_blocks,
      AVG(bhd.demand_score) as avg_demand,
      AVG(os.gap_score) as avg_gap,
      nb.avg_composite_score as avg_composite,
      SUM(COALESCE(os.specialty_count_500m,0) + COALESCE(os.premium_count_500m,0) + COALESCE(os.mainstream_count_500m,0)) as total_competitors,
      ST_X(ST_Centroid(nb.geom)) as centroid_lng,
      ST_Y(ST_Centroid(nb.geom)) as centroid_lat
    FROM nta_boundaries nb
    LEFT JOIN census_blocks cb ON cb.nta_code = nb.nta_code
    LEFT JOIN block_hourly_demand bhd
      ON cb.geoid = bhd.census_block_geoid AND bhd.time_window = ${timeWindow}
    LEFT JOIN opportunity_scores os
      ON cb.geoid = os.census_block_geoid
    WHERE nb.geom IS NOT NULL
    GROUP BY nb.nta_code, nb.nta_name, nb.borough, nb.total_blocks, nb.avg_composite_score, nb.geom
    HAVING AVG(bhd.demand_score) IS NOT NULL
    ORDER BY AVG(bhd.demand_score) DESC
  `;

  const neighborhoods = rows.map((r) => ({
    ntaCode: r.nta_code,
    ntaName: r.nta_name,
    borough: r.borough,
    totalBlocks: Number(r.total_blocks ?? 0),
    avgDemand: r.avg_demand != null ? Number(Number(r.avg_demand).toFixed(1)) : null,
    avgGap: r.avg_gap != null ? Number(Number(r.avg_gap).toFixed(1)) : null,
    avgComposite: r.avg_composite != null ? Number(Number(r.avg_composite).toFixed(1)) : null,
    totalCompetitors: Number(r.total_competitors ?? 0),
    centroid: r.centroid_lng != null && r.centroid_lat != null
      ? [r.centroid_lng, r.centroid_lat]
      : null,
  }));

  return NextResponse.json({ neighborhoods });
}
