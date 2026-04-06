/**
 * Recompute BlockHourlyDemand rows using the calibrated demand model.
 * Run after updating demand-model.ts or profiles.ts.
 *
 * Usage: npx tsx scripts/recompute-demand.ts [--profile coffee|food_truck|political|retail_popup]
 */
import { PrismaClient } from "@prisma/client";
import { computeBlockDemand } from "../app/lib/demand-model";
import { getProfile } from "../app/lib/profiles";
import { TIME_WINDOWS } from "../app/lib/constants";

const BATCH_SIZE = 500;

async function main() {
  const profileKey = process.argv.includes("--profile")
    ? process.argv[process.argv.indexOf("--profile") + 1]
    : "coffee";
  const profile = getProfile(profileKey);

  console.log(`Recomputing demand with profile: ${profile.name}`);

  const p = new PrismaClient();
  try {
    // Count total blocks
    const [{ count }] = await p.$queryRawUnsafe<[{ count: number }]>(
      `SELECT COUNT(*)::int as count FROM census_blocks WHERE total_jobs IS NOT NULL OR total_residential_units IS NOT NULL`,
    );
    console.log(`Blocks to process: ${count}`);

    let processed = 0;
    let offset = 0;

    while (offset < count) {
      const blocks = await p.$queryRawUnsafe<
        Array<{
          geoid: string;
          total_jobs: number | null;
          office_jobs: number | null;
          retail_jobs: number | null;
          primary_land_use: string | null;
          total_residential_units: number | null;
          nearest_subway_meters: number | null;
        }>
      >(`
        SELECT
          geoid,
          total_jobs,
          (COALESCE(cns10_finance,0) + COALESCE(cns11_real_estate,0) +
           COALESCE(cns12_professional,0) + COALESCE(cns13_management,0) +
           COALESCE(cns14_administrative,0) + COALESCE(cns09_information,0))::int AS office_jobs,
          COALESCE(cns07_retail,0)::int AS retail_jobs,
          primary_land_use,
          total_residential_units,
          nearest_subway_meters
        FROM census_blocks
        WHERE total_jobs IS NOT NULL OR total_residential_units IS NOT NULL
        ORDER BY geoid
        LIMIT ${BATCH_SIZE} OFFSET ${offset}
      `);

      if (blocks.length === 0) break;

      // Compute demand for each block
      const values: string[] = [];
      for (const b of blocks) {
        const demand = computeBlockDemand(
          {
            totalJobs: b.total_jobs ?? 0,
            officeJobs: b.office_jobs ?? 0,
            retailJobs: b.retail_jobs ?? 0,
            primaryLandUse: b.primary_land_use,
            totalResUnits: b.total_residential_units ?? 0,
            nearestSubwayMeters: b.nearest_subway_meters,
          },
          profile,
        );

        for (const tw of TIME_WINDOWS) {
          const score = demand[tw];
          const components = JSON.stringify({
            officeJobs: b.office_jobs ?? 0,
            retailJobs: b.retail_jobs ?? 0,
            totalJobs: b.total_jobs ?? 0,
            resUnits: b.total_residential_units ?? 0,
            landUse: b.primary_land_use,
            subwayM: b.nearest_subway_meters,
          }).replace(/'/g, "''");
          values.push(
            `('${b.geoid}', '${tw}', ${score}, '${components}'::jsonb)`,
          );
        }
      }

      // Upsert batch
      await p.$executeRawUnsafe(`
        INSERT INTO block_hourly_demand (census_block_geoid, time_window, demand_score, demand_components)
        VALUES ${values.join(",\n")}
        ON CONFLICT (census_block_geoid, time_window)
        DO UPDATE SET
          demand_score = EXCLUDED.demand_score,
          demand_components = EXCLUDED.demand_components
      `);

      processed += blocks.length;
      offset += BATCH_SIZE;
      if (processed % 5000 === 0 || processed === count) {
        console.log(`  ${processed}/${count} blocks (${((processed / count) * 100).toFixed(1)}%)`);
      }
    }

    console.log(`\n✓ Recomputed ${processed} blocks × ${TIME_WINDOWS.length} windows = ${processed * TIME_WINDOWS.length} demand rows`);
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
