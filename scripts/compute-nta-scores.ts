/**
 * Compute avg_composite_score for each NTA boundary
 * by aggregating block-level opportunity scores.
 *
 * Usage: npx tsx scripts/compute-nta-scores.ts
 */
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  try {
    console.log("Computing NTA composite scores...");

    const result = await p.$executeRawUnsafe(`
      UPDATE nta_boundaries nb SET
        avg_composite_score = sub.avg_score,
        total_jobs = sub.total_jobs,
        total_blocks = sub.total_blocks
      FROM (
        SELECT
          cb.nta_code,
          AVG(os.composite_score)::float AS avg_score,
          SUM(COALESCE(cb.total_jobs, 0))::int AS total_jobs,
          COUNT(*)::int AS total_blocks
        FROM census_blocks cb
        JOIN opportunity_scores os ON os.census_block_geoid = cb.geoid
        WHERE cb.nta_code IS NOT NULL
        GROUP BY cb.nta_code
      ) sub
      WHERE nb.nta_code = sub.nta_code
    `);

    console.log(`Updated ${result} NTA boundaries`);

    // Verify
    const sample = await p.$queryRawUnsafe<
      Array<{ nta_name: string; avg_composite_score: number; total_jobs: number; total_blocks: number }>
    >(`
      SELECT nta_name, avg_composite_score, total_jobs, total_blocks
      FROM nta_boundaries
      WHERE avg_composite_score IS NOT NULL
      ORDER BY avg_composite_score DESC
      LIMIT 10
    `);
    console.log("\nTop 10 NTAs by composite score:");
    sample.forEach((r) =>
      console.log(
        `  ${r.avg_composite_score.toFixed(1).padStart(5)}  ${r.total_jobs.toString().padStart(7)} jobs  ${r.total_blocks.toString().padStart(4)} blocks  ${r.nta_name}`,
      ),
    );
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
