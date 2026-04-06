import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

/** GET: Return competitor stats and refresh status */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu || tu.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const [total, byCategory, bySource, stale] = await Promise.all([
    prisma.competitorLocation.count(),
    prisma.$queryRawUnsafe<Array<{ category: string; count: bigint }>>(`
      SELECT COALESCE(category, 'Unknown') as category, COUNT(*) as count
      FROM competitor_locations
      GROUP BY category ORDER BY count DESC
    `),
    prisma.$queryRawUnsafe<Array<{ source: string; count: bigint }>>(`
      SELECT COALESCE(source, 'manual') as source, COUNT(*) as count
      FROM competitor_locations
      GROUP BY source ORDER BY count DESC
    `),
    prisma.$queryRawUnsafe<[{ count: bigint }]>(`
      SELECT COUNT(*) FROM competitor_locations
      WHERE last_verified_at IS NULL OR last_verified_at < NOW() - INTERVAL '90 days'
    `),
  ]);

  const lastRefresh = await prisma.$queryRawUnsafe<[{ max: Date | null }]>(`
    SELECT MAX(last_verified_at) as max FROM competitor_locations WHERE source = 'osm'
  `);

  return NextResponse.json({
    total,
    staleCount: Number(stale[0].count),
    lastOsmRefresh: lastRefresh[0].max,
    byCategory: byCategory.map((r) => ({ category: r.category, count: Number(r.count) })),
    bySource: bySource.map((r) => ({ source: r.source, count: Number(r.count) })),
  });
}

/** POST: Trigger a competitor refresh for a specific category */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu || tu.role !== "admin") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const { category } = body as { category?: string };

  const OVERPASS_API = "https://overpass-api.de/api/interpreter";
  const NYC_BBOX = "40.49,-74.27,40.92,-73.68";

  const QUERIES: Record<string, { query: string; dbCategory: string }> = {
    coffee: {
      query: `[out:json][timeout:120];(node["amenity"="cafe"](${NYC_BBOX});way["amenity"="cafe"](${NYC_BBOX}););out center;`,
      dbCategory: "Coffee/Tea",
    },
    food_truck: {
      query: `[out:json][timeout:120];(node["amenity"="fast_food"](${NYC_BBOX});way["amenity"="fast_food"](${NYC_BBOX}););out center;`,
      dbCategory: "Food Truck",
    },
    retail: {
      query: `[out:json][timeout:120];(node["shop"~"convenience|clothes|shoes|boutique"](${NYC_BBOX});way["shop"~"convenience|clothes|shoes|boutique"](${NYC_BBOX}););out center;`,
      dbCategory: "Retail",
    },
  };

  const queryKey = category || "coffee";
  const config = QUERIES[queryKey];
  if (!config) {
    return NextResponse.json({ error: `Unknown category: ${queryKey}` }, { status: 400 });
  }

  try {
    const res = await fetch(OVERPASS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(config.query)}`,
      signal: AbortSignal.timeout(180_000),
    });

    if (!res.ok) {
      return NextResponse.json({ error: `Overpass API error: ${res.status}` }, { status: 502 });
    }

    const data = await res.json();
    const elements: Array<{
      type: string;
      id: number;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
      tags?: Record<string, string>;
    }> = data.elements;

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
      const name = el.tags.name;
      const address = el.tags["addr:full"] || el.tags["addr:street"] || null;

      // Simple chain detection
      const nameLower = name.toLowerCase();
      const isChain = ["starbucks", "dunkin", "mcdonald", "burger king", "subway", "chipotle"].some(
        (c) => nameLower.includes(c)
      );
      const qualityTier = isChain ? "mainstream" : "premium";

      const result = await prisma.$executeRawUnsafe(
        `INSERT INTO competitor_locations
          (id, name, address, lat, lng, category, quality_tier, is_chain, brand_name,
           external_id, source, source_grade, last_verified_at, created_at, geom)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9, 'osm', 'B', NOW(), NOW(),
                 ST_SetSRID(ST_MakePoint($4, $3), 4326))
         ON CONFLICT (external_id) DO UPDATE SET
           name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng,
           quality_tier = EXCLUDED.quality_tier, is_chain = EXCLUDED.is_chain,
           brand_name = EXCLUDED.brand_name, last_verified_at = NOW()`,
        name,
        address,
        lat,
        lon,
        config.dbCategory,
        qualityTier,
        isChain,
        isChain ? (el.tags.brand || name) : null,
        externalId,
      );

      if (result > 0) {
        // Can't distinguish insert vs update from executeRawUnsafe, count all as processed
        inserted++;
      }
    }

    const total = await prisma.competitorLocation.count();

    return NextResponse.json({
      category: queryKey,
      fetched: elements.length,
      processed: inserted,
      skipped,
      totalCompetitors: total,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refresh failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
