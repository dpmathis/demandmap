import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface BlockFilters {
  boroughs?: string[];
  maxCompetitors?: number;
}

export interface CompetitorFilters {
  tiers?: string[];
  chainFilter?: "all" | "chain" | "independent";
  categories?: string[];
}

// Map vendor vertical → competitor categories that compete for the same customers.
// Only "Coffee/Tea" is currently seeded; other verticals resolve to [] (0 competitors shown honestly).
export const VERTICAL_COMPETITOR_CATEGORIES: Record<string, string[]> = {
  coffee: ["Coffee/Tea"],
  food_truck: ["Food Truck", "Quick Service Restaurant", "Street Food"],
  retail: ["Retail", "Pop-Up"],
  political: [], // no head-to-head competitor type
  events: ["Event Venue", "Catering"],
  custom: [], // user-defined
};

/**
 * Fetch census blocks with demand data in a bounding box as GeoJSON.
 * When vertical is provided and isn't "coffee", demand scores are computed
 * on-the-fly from raw census block features using the matching profile.
 */
export async function getBlocksInBBox(
  bbox: BBox,
  timeWindow: string,
  filters?: BlockFilters,
  vertical?: string,
) {
  const conditions: Prisma.Sql[] = [];

  if (filters?.boroughs && filters.boroughs.length > 0) {
    conditions.push(Prisma.sql`AND cb.borough = ANY(${filters.boroughs})`);
  }
  if (filters?.maxCompetitors != null && filters.maxCompetitors < 100) {
    conditions.push(
      Prisma.sql`AND COALESCE(os.specialty_count_500m,0) + COALESCE(os.premium_count_500m,0) + COALESCE(os.mainstream_count_500m,0) <= ${filters.maxCompetitors}`
    );
  }

  const extraWhere = conditions.length > 0
    ? Prisma.join(conditions, " ")
    : Prisma.empty;

  const needsLiveCompute = vertical && vertical !== "coffee";

  type BlockRow = {
    geojson: string;
    geoid: string;
    nta_name: string | null;
    borough: string | null;
    demand_score: number | null;
    total_jobs: number | null;
    total_office_sqft: number | null;
    total_residential_units: number | null;
    nearest_subway_meters: number | null;
    subway_lines: string | null;
    primary_land_use: string | null;
    composite_score: number | null;
    supply_score: number | null;
    demand_score_opp: number | null;
    gap_score: number | null;
    specialty_count_500m: number | null;
    premium_count_500m: number | null;
    mainstream_count_500m: number | null;
    // Sector columns for live demand computation
    cns07_retail: number | null;
    cns09_information: number | null;
    cns10_finance: number | null;
    cns11_real_estate: number | null;
    cns12_professional: number | null;
    cns13_management: number | null;
    cns14_administrative: number | null;
  };

  const useAvg = timeWindow === "avg";

  const rows = useAvg
    ? await prisma.$queryRaw<BlockRow[]>`
      SELECT
        ST_AsGeoJSON(cb.geom, 6) as geojson,
        cb.geoid,
        cb.nta_name,
        cb.borough,
        bhd_avg.demand_score,
        cb.total_jobs,
        cb.total_office_sqft,
        cb.total_residential_units,
        cb.nearest_subway_meters,
        cb.subway_lines,
        cb.primary_land_use,
        os.composite_score,
        os.supply_score,
        os.demand_score as demand_score_opp,
        os.gap_score,
        os.specialty_count_500m,
        os.premium_count_500m,
        os.mainstream_count_500m,
        cb.cns07_retail,
        cb.cns09_information,
        cb.cns10_finance,
        cb.cns11_real_estate,
        cb.cns12_professional,
        cb.cns13_management,
        cb.cns14_administrative
      FROM census_blocks cb
      LEFT JOIN (
        SELECT census_block_geoid, AVG(demand_score) as demand_score
        FROM block_hourly_demand
        GROUP BY census_block_geoid
      ) bhd_avg ON cb.geoid = bhd_avg.census_block_geoid
      LEFT JOIN opportunity_scores os
        ON cb.geoid = os.census_block_geoid
      WHERE cb.geom IS NOT NULL
        AND ST_Intersects(cb.geom, ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326))
        ${extraWhere}
    `
    : await prisma.$queryRaw<BlockRow[]>`
      SELECT
        ST_AsGeoJSON(cb.geom, 6) as geojson,
        cb.geoid,
        cb.nta_name,
        cb.borough,
        bhd.demand_score,
        cb.total_jobs,
        cb.total_office_sqft,
        cb.total_residential_units,
        cb.nearest_subway_meters,
        cb.subway_lines,
        cb.primary_land_use,
        os.composite_score,
        os.supply_score,
        os.demand_score as demand_score_opp,
        os.gap_score,
        os.specialty_count_500m,
        os.premium_count_500m,
        os.mainstream_count_500m,
        cb.cns07_retail,
        cb.cns09_information,
        cb.cns10_finance,
        cb.cns11_real_estate,
        cb.cns12_professional,
        cb.cns13_management,
        cb.cns14_administrative
      FROM census_blocks cb
      LEFT JOIN block_hourly_demand bhd
        ON cb.geoid = bhd.census_block_geoid AND bhd.time_window = ${timeWindow}
      LEFT JOIN opportunity_scores os
        ON cb.geoid = os.census_block_geoid
      WHERE cb.geom IS NOT NULL
        AND ST_Intersects(cb.geom, ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326))
        ${extraWhere}
    `;

  // If non-coffee vertical, recompute demand on the fly using the selected profile
  let computeFn: ((row: (typeof rows)[number]) => number | null) | null = null;
  if (needsLiveCompute) {
    const { computeBlockDemand } = await import("../demand-model");
    const { getProfile } = await import("../profiles");
    const profile = getProfile(vertical);

    computeFn = (row) => {
      const officeJobs =
        (row.cns10_finance ?? 0) +
        (row.cns11_real_estate ?? 0) +
        (row.cns12_professional ?? 0) +
        (row.cns13_management ?? 0) +
        (row.cns14_administrative ?? 0) +
        (row.cns09_information ?? 0);
      const retailJobs = row.cns07_retail ?? 0;

      const result = computeBlockDemand(
        {
          totalJobs: row.total_jobs ?? 0,
          officeJobs,
          retailJobs,
          primaryLandUse: row.primary_land_use,
          totalResUnits: row.total_residential_units ?? 0,
          nearestSubwayMeters: row.nearest_subway_meters,
        },
        profile,
      );
      if (useAvg) {
        const vals = Object.values(result).filter((v): v is number => v != null);
        return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      }
      return result[timeWindow as keyof typeof result] ?? null;
    };
  }

  return {
    type: "FeatureCollection" as const,
    features: rows.map((row) => ({
      type: "Feature" as const,
      geometry: JSON.parse(row.geojson),
      properties: {
        geoid: row.geoid,
        ntaName: row.nta_name,
        borough: row.borough,
        demandScore: computeFn ? computeFn(row) : row.demand_score,
        totalJobs: row.total_jobs,
        totalOfficeSqft: row.total_office_sqft,
        totalResUnits: row.total_residential_units,
        nearestSubwayMeters: row.nearest_subway_meters,
        subwayLines: row.subway_lines,
        primaryLandUse: row.primary_land_use,
        compositeScore: row.composite_score,
        supplyScore: row.supply_score,
        gapScore: row.gap_score,
        specialtyCount500m: row.specialty_count_500m,
        premiumCount500m: row.premium_count_500m,
        mainstreamCount500m: row.mainstream_count_500m,
      },
    })),
  };
}

/**
 * Fetch competitors in a bounding box as GeoJSON.
 */
export async function getCompetitorsInBBox(bbox: BBox, filters?: CompetitorFilters) {
  const conditions: Prisma.Sql[] = [];

  if (filters?.tiers && filters.tiers.length > 0 && filters.tiers.length < 3) {
    conditions.push(Prisma.sql`AND cl.quality_tier = ANY(${filters.tiers})`);
  }
  if (filters?.chainFilter === "chain") {
    conditions.push(Prisma.sql`AND cl.is_chain = true`);
  } else if (filters?.chainFilter === "independent") {
    conditions.push(Prisma.sql`AND cl.is_chain = false`);
  }
  if (filters?.categories && filters.categories.length > 0) {
    conditions.push(Prisma.sql`AND cl.category = ANY(${filters.categories})`);
  }

  const extraWhere = conditions.length > 0
    ? Prisma.join(conditions, " ")
    : Prisma.empty;

  const rows = await prisma.$queryRaw<
    Array<{
      geojson: string;
      id: string;
      name: string;
      category: string | null;
      quality_tier: string | null;
      source_grade: string | null;
      is_chain: boolean;
      brand_name: string | null;
    }>
  >`
    SELECT
      ST_AsGeoJSON(cl.geom, 6) as geojson,
      cl.id, cl.name, cl.category, cl.quality_tier,
      cl.source_grade, cl.is_chain, cl.brand_name
    FROM competitor_locations cl
    WHERE cl.geom IS NOT NULL
      AND ST_Intersects(cl.geom, ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326))
      ${extraWhere}
  `;

  return {
    type: "FeatureCollection" as const,
    features: rows.map((row) => ({
      type: "Feature" as const,
      geometry: JSON.parse(row.geojson),
      properties: {
        id: row.id,
        name: row.name,
        category: row.category,
        qualityTier: row.quality_tier,
        sourceGrade: row.source_grade,
        isChain: row.is_chain,
        brandName: row.brand_name,
      },
    })),
  };
}

/**
 * Fetch subway stations in a bounding box as GeoJSON.
 */
export async function getStationsInBBox(bbox: BBox) {
  const rows = await prisma.$queryRaw<
    Array<{ geojson: string; id: string; name: string; lines: string | null }>
  >`
    SELECT ST_AsGeoJSON(geom, 6) as geojson, id, name, lines
    FROM subway_stations
    WHERE geom IS NOT NULL
      AND ST_Intersects(geom, ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326))
  `;

  return {
    type: "FeatureCollection" as const,
    features: rows.map((row) => ({
      type: "Feature" as const,
      geometry: JSON.parse(row.geojson),
      properties: { id: row.id, name: row.name, lines: row.lines },
    })),
  };
}

/**
 * Fetch station busyness data (baseline + percentile) in a bounding box.
 */
export async function getStationBusynessInBBox(bbox: BBox, dayOfWeek: number, hour: number) {
  const rows = await prisma.$queryRaw<
    Array<{
      geojson: string;
      id: string;
      name: string;
      lines: string | null;
      station_complex_id: string | null;
      avg_ridership: number | null;
      baseline_pctile: number | null;
    }>
  >`
    SELECT
      ST_AsGeoJSON(ss.geom, 6) as geojson,
      ss.id, ss.name, ss.lines, ss.station_complex_id,
      srb.avg_ridership,
      PERCENT_RANK() OVER (ORDER BY COALESCE(srb.avg_ridership, 0)) as baseline_pctile
    FROM subway_stations ss
    LEFT JOIN station_ridership_baselines srb
      ON ss.station_complex_id = srb.station_complex_id
      AND srb.day_of_week = ${dayOfWeek}
      AND srb.hour = ${hour}
    WHERE ss.geom IS NOT NULL
      AND ss.station_complex_id IS NOT NULL
      AND ST_Intersects(ss.geom, ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326))
  `;

  return rows.map((row) => ({
    geojson: row.geojson,
    id: row.id,
    name: row.name,
    lines: row.lines,
    stationComplexId: row.station_complex_id,
    avgRidership: row.avg_ridership,
    baselinePctile: row.baseline_pctile != null ? Number(row.baseline_pctile) : 0,
  }));
}
