import { prisma } from "./prisma";

export interface BBox {
  west: number;
  south: number;
  east: number;
  north: number;
}

/**
 * Fetch census blocks with demand data in a bounding box as GeoJSON.
 */
export async function getBlocksInBBox(bbox: BBox, timeWindow: string) {
  const rows = await prisma.$queryRaw<
    Array<{
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
    }>
  >`
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
      os.mainstream_count_500m
    FROM census_blocks cb
    LEFT JOIN block_hourly_demand bhd
      ON cb.geoid = bhd.census_block_geoid AND bhd.time_window = ${timeWindow}
    LEFT JOIN opportunity_scores os
      ON cb.geoid = os.census_block_geoid
    WHERE cb.geom IS NOT NULL
      AND ST_Intersects(cb.geom, ST_MakeEnvelope(${bbox.west}, ${bbox.south}, ${bbox.east}, ${bbox.north}, 4326))
  `;

  return {
    type: "FeatureCollection" as const,
    features: rows.map((row) => ({
      type: "Feature" as const,
      geometry: JSON.parse(row.geojson),
      properties: {
        geoid: row.geoid,
        ntaName: row.nta_name,
        borough: row.borough,
        demandScore: row.demand_score,
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
export async function getCompetitorsInBBox(bbox: BBox) {
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
