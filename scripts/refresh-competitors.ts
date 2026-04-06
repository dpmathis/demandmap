/**
 * Refresh competitor locations from OpenStreetMap Overpass API.
 *
 * Pulls cafes, fast food, restaurants, and retail shops within NYC bounds.
 * Deduplicates against existing data via external_id (osm:<type>/<id>).
 * Updates lastVerifiedAt for matches, inserts new entries.
 *
 * Usage: npx tsx scripts/refresh-competitors.ts [--category coffee|food_truck|retail]
 */
import { PrismaClient } from "@prisma/client";

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

// NYC bounding box (south, west, north, east)
const NYC_BBOX = "40.49,-74.27,40.92,-73.68";

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

// Maps Overpass tags to our internal categories
const CATEGORY_QUERIES: Record<string, { query: string; category: string }> = {
  coffee: {
    query: `[out:json][timeout:120];(node["amenity"="cafe"](${NYC_BBOX});way["amenity"="cafe"](${NYC_BBOX}););out center;`,
    category: "Coffee/Tea",
  },
  food_truck: {
    query: `[out:json][timeout:120];(node["amenity"="fast_food"](${NYC_BBOX});way["amenity"="fast_food"](${NYC_BBOX});node["cuisine"~"street_food"](${NYC_BBOX}););out center;`,
    category: "Food Truck",
  },
  retail: {
    query: `[out:json][timeout:120];(node["shop"~"convenience|clothes|shoes|boutique"](${NYC_BBOX});way["shop"~"convenience|clothes|shoes|boutique"](${NYC_BBOX}););out center;`,
    category: "Retail",
  },
};

// Known chain brands → quality tier mapping
const CHAIN_BRANDS: Record<string, string> = {
  starbucks: "mainstream",
  dunkin: "mainstream",
  "dunkin'": "mainstream",
  "tim hortons": "mainstream",
  "peet's coffee": "premium",
  "blue bottle": "specialty",
  "la colombe": "specialty",
  "stumptown": "specialty",
  "joe coffee": "specialty",
  "gregorys coffee": "premium",
  "think coffee": "premium",
  "birch coffee": "specialty",
  "oren's daily roast": "specialty",
  "mcdonald's": "mainstream",
  mcdonalds: "mainstream",
  "burger king": "mainstream",
  "wendy's": "mainstream",
  "subway": "mainstream",
  "chipotle": "mainstream",
  "shake shack": "premium",
  "sweetgreen": "premium",
};

function classifyCompetitor(tags: Record<string, string>): {
  qualityTier: string;
  isChain: boolean;
  brandName: string | null;
} {
  const name = (tags.name || "").toLowerCase();
  const brand = (tags.brand || tags["brand:wikidata"] || "").toLowerCase();
  const operator = (tags.operator || "").toLowerCase();

  // Check known chains
  for (const [chainName, tier] of Object.entries(CHAIN_BRANDS)) {
    if (name.includes(chainName) || brand.includes(chainName) || operator.includes(chainName)) {
      return {
        qualityTier: tier,
        isChain: true,
        brandName: tags.brand || tags.name || chainName,
      };
    }
  }

  // Heuristics for quality tier
  const cuisine = (tags.cuisine || "").toLowerCase();
  if (cuisine.includes("coffee") || tags.amenity === "cafe") {
    // Independent cafe → default to premium
    return { qualityTier: "premium", isChain: false, brandName: null };
  }

  return { qualityTier: "mainstream", isChain: false, brandName: null };
}

async function fetchOverpass(query: string): Promise<OverpassElement[]> {
  console.log("  Querying Overpass API...");
  const res = await fetch(OVERPASS_API, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    throw new Error(`Overpass API error: ${res.status} ${res.statusText}`);
  }

  const data: OverpassResponse = await res.json();
  return data.elements;
}

async function refreshCategory(
  p: PrismaClient,
  categoryKey: string,
) {
  const config = CATEGORY_QUERIES[categoryKey];
  if (!config) {
    console.error(`Unknown category: ${categoryKey}`);
    return;
  }

  console.log(`\nRefreshing ${config.category}...`);
  const elements = await fetchOverpass(config.query);
  console.log(`  Found ${elements.length} elements from OSM`);

  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon || !el.tags?.name) {
      skipped++;
      continue;
    }

    const externalId = `osm:${el.type}/${el.id}`;
    const { qualityTier, isChain, brandName } = classifyCompetitor(el.tags);

    const existing = await p.competitorLocation.findUnique({
      where: { externalId },
    });

    if (existing) {
      // Update verification timestamp and any changed fields
      await p.competitorLocation.update({
        where: { externalId },
        data: {
          name: el.tags.name,
          lat,
          lng: lon,
          qualityTier,
          isChain,
          brandName,
          lastVerifiedAt: new Date(),
        },
      });
      updated++;
    } else {
      // Insert with PostGIS point geometry
      await p.$executeRawUnsafe(
        `INSERT INTO competitor_locations
          (id, name, address, lat, lng, category, quality_tier, is_chain, brand_name,
           external_id, source, source_grade, last_verified_at, created_at, geom)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'osm', 'B', NOW(), NOW(),
                 ST_SetSRID(ST_MakePoint($4, $3), 4326))
         ON CONFLICT (external_id) DO UPDATE SET
           name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
           quality_tier = EXCLUDED.quality_tier, is_chain = EXCLUDED.is_chain,
           brand_name = EXCLUDED.brand_name, last_verified_at = NOW()`,
        el.tags.name,
        el.tags["addr:full"] || el.tags["addr:street"] || null,
        lat,
        lon,
        config.category,
        qualityTier,
        isChain,
        brandName,
        externalId,
      );
      inserted++;
    }
  }

  console.log(`  Results: ${inserted} inserted, ${updated} verified, ${skipped} skipped (no name/coords)`);
}

async function main() {
  const p = new PrismaClient();
  const categoryArg = process.argv.find((a) => a.startsWith("--category="))?.split("=")[1];
  const categories = categoryArg ? [categoryArg] : Object.keys(CATEGORY_QUERIES);

  try {
    console.log("Competitor Data Refresh");
    console.log("=======================");

    for (const cat of categories) {
      await refreshCategory(p, cat);
    }

    // Summary
    const total = await p.competitorLocation.count();
    const verified = await p.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) FROM competitor_locations WHERE last_verified_at > NOW() - INTERVAL '30 days'`
    );
    const stale = await p.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) FROM competitor_locations WHERE last_verified_at IS NULL OR last_verified_at < NOW() - INTERVAL '90 days'`
    );

    console.log("\n--- Summary ---");
    console.log(`Total competitors: ${total}`);
    console.log(`Verified (30d): ${verified[0].count}`);
    console.log(`Stale (>90d or never verified): ${stale[0].count}`);

    // Recompute opportunity scores after refresh
    console.log("\nRecomputing opportunity scores for affected blocks...");
    await p.$executeRawUnsafe(`
      UPDATE opportunity_scores os SET
        specialty_count_500m = sub.specialty,
        premium_count_500m = sub.premium,
        mainstream_count_500m = sub.mainstream,
        supply_score = LEAST(100, (sub.specialty * 3 + sub.premium * 2 + sub.mainstream) * 2),
        computed_at = NOW()
      FROM (
        SELECT
          cb.geoid,
          COUNT(*) FILTER (WHERE cl.quality_tier = 'specialty') AS specialty,
          COUNT(*) FILTER (WHERE cl.quality_tier = 'premium') AS premium,
          COUNT(*) FILTER (WHERE cl.quality_tier = 'mainstream') AS mainstream
        FROM census_blocks cb
        LEFT JOIN competitor_locations cl
          ON ST_DWithin(cb.geom::geography, cl.geom::geography, 500)
        WHERE cb.geom IS NOT NULL
        GROUP BY cb.geoid
      ) sub
      WHERE os.census_block_geoid = sub.geoid
    `);
    console.log("Opportunity scores updated.");
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
