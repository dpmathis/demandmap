/**
 * Calibrate demand model against REAL MTA weekday ridership (Nov 2024).
 *
 * Ground truth: NYC Open Data MTA hourly ridership per station complex.
 * Features: LEHD jobs + PLUTO land use summed over a 400m walkshed per station.
 *
 * Output: per-time-window OLS coefficients and empirically-derived land-use curves.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const WALKSHED_M = 400;

const WINDOWS: Array<[string, number, number]> = [
  ["07-09", 7, 9],
  ["09-11", 9, 11],
  ["11-13", 11, 13],
  ["13-15", 13, 15],
  ["15-17", 15, 17],
  ["17-19", 17, 19],
  ["19-21", 19, 21],
];

const LAND_USES = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"];

// ─── Stats helpers ──────────────────────────────────────────────
function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function std(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    dx += (xs[i] - mx) ** 2;
    dy += (ys[i] - my) ** 2;
  }
  return dx === 0 || dy === 0 ? 0 : num / Math.sqrt(dx * dy);
}
function ols(
  X: number[][],
  y: number[],
): { coef: number[]; r2: number; n: number } {
  const n = X.length;
  const p = X[0].length;
  const XtX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  const Xty: number[] = Array(p).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      Xty[j] += X[i][j] * y[i];
      for (let k = 0; k < p; k++) XtX[j][k] += X[i][j] * X[i][k];
    }
  }
  const A: number[][] = XtX.map((row, i) => [...row, Xty[i]]);
  for (let i = 0; i < p; i++) {
    let pivot = i;
    for (let r = i + 1; r < p; r++) {
      if (Math.abs(A[r][i]) > Math.abs(A[pivot][i])) pivot = r;
    }
    [A[i], A[pivot]] = [A[pivot], A[i]];
    const piv = A[i][i];
    if (Math.abs(piv) < 1e-12) return { coef: Array(p).fill(0), r2: 0, n };
    for (let j = 0; j <= p; j++) A[i][j] /= piv;
    for (let r = 0; r < p; r++) {
      if (r === i) continue;
      const f = A[r][i];
      for (let j = 0; j <= p; j++) A[r][j] -= f * A[i][j];
    }
  }
  const coef = A.map((row) => row[p]);
  const yhat = X.map((row) => row.reduce((s, v, j) => s + v * coef[j], 0));
  const my = mean(y);
  const ssTot = y.reduce((s, v) => s + (v - my) ** 2, 0);
  const ssRes = y.reduce((s, v, i) => s + (v - yhat[i]) ** 2, 0);
  return { coef, r2: ssTot === 0 ? 0 : 1 - ssRes / ssTot, n };
}

interface MtaRow {
  station_complex_id: string;
  station_complex: string;
  latitude: string;
  longitude: string;
  hr: string;
  total_ridership: string;
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  const p = new PrismaClient();
  try {
    // ── 1. Load and aggregate MTA data ──
    console.log("Loading MTA ridership data...");
    const raw: MtaRow[] = JSON.parse(
      readFileSync(join(process.cwd(), "scripts/mta-ridership-raw.json"), "utf8"),
    );

    // Aggregate to station_complex_id × hour
    const stationHourMap = new Map<string, Map<number, number>>();
    const stationMeta = new Map<
      string,
      { name: string; lat: number; lng: number }
    >();
    for (const r of raw) {
      const sid = r.station_complex_id;
      const hr = parseInt(r.hr);
      const ride = parseFloat(r.total_ridership);
      if (!stationHourMap.has(sid)) stationHourMap.set(sid, new Map());
      stationHourMap.get(sid)!.set(hr, (stationHourMap.get(sid)!.get(hr) ?? 0) + ride);
      if (!stationMeta.has(sid)) {
        stationMeta.set(sid, {
          name: r.station_complex,
          lat: parseFloat(r.latitude),
          lng: parseFloat(r.longitude),
        });
      }
    }

    // Collapse to time windows
    interface StationData {
      id: string;
      name: string;
      lat: number;
      lng: number;
      windows: Record<string, number>;
    }
    const stations: StationData[] = [];
    for (const [sid, hourMap] of stationHourMap) {
      const meta = stationMeta.get(sid)!;
      const windows: Record<string, number> = {};
      for (const [winKey, startH, endH] of WINDOWS) {
        let total = 0;
        for (let h = startH; h < endH; h++) total += hourMap.get(h) ?? 0;
        windows[winKey] = total;
      }
      // Skip stations with no ridership in operating hours
      if (Object.values(windows).every((v) => v === 0)) continue;
      stations.push({ id: sid, name: meta.name, lat: meta.lat, lng: meta.lng, windows });
    }
    console.log(`MTA stations with ridership: ${stations.length}`);

    // Top/bottom for sanity
    const byPeak = [...stations].sort((a, b) => b.windows["07-09"] - a.windows["07-09"]);
    console.log("\nTop 5 by AM peak (07-09):");
    byPeak.slice(0, 5).forEach((s) =>
      console.log(`  ${s.windows["07-09"].toFixed(0).padStart(8)}  ${s.name}`),
    );
    console.log("Bottom 5:");
    byPeak.slice(-5).forEach((s) =>
      console.log(`  ${s.windows["07-09"].toFixed(0).padStart(8)}  ${s.name}`),
    );

    // ── 2. Insert station points into temp table and do spatial walkshed join ──
    console.log("\nBuilding walkshed features via PostGIS...");

    // Create temp table with MTA station points
    await p.$executeRawUnsafe(`DROP TABLE IF EXISTS _mta_stations_tmp`);
    await p.$executeRawUnsafe(`
      CREATE TEMP TABLE _mta_stations_tmp (
        sid TEXT PRIMARY KEY,
        geom GEOMETRY(Point, 4326)
      )
    `);

    // Batch insert
    const batchSize = 100;
    for (let i = 0; i < stations.length; i += batchSize) {
      const batch = stations.slice(i, i + batchSize);
      const values = batch
        .map((s) => `('${s.id}', ST_SetSRID(ST_MakePoint(${s.lng}, ${s.lat}), 4326))`)
        .join(",\n");
      await p.$executeRawUnsafe(
        `INSERT INTO _mta_stations_tmp (sid, geom) VALUES ${values}`,
      );
    }

    // Spatial join: walkshed features per MTA station
    const walkshed = await p.$queryRawUnsafe<
      Array<{
        sid: string;
        office_jobs: number;
        retail_jobs: number;
        other_jobs: number;
        res_units: number;
        land_area_sqm: number;
        [key: string]: number | string;
      }>
    >(`
      SELECT
        m.sid,
        COALESCE(SUM(
          COALESCE(cb.cns10_finance,0) +
          COALESCE(cb.cns11_real_estate,0) +
          COALESCE(cb.cns12_professional,0) +
          COALESCE(cb.cns13_management,0) +
          COALESCE(cb.cns14_administrative,0) +
          COALESCE(cb.cns09_information,0)
        ), 0)::float AS office_jobs,
        COALESCE(SUM(COALESCE(cb.cns07_retail,0)), 0)::float AS retail_jobs,
        COALESCE(SUM(GREATEST(COALESCE(cb.total_jobs,0) -
            COALESCE(cb.cns07_retail,0) -
            COALESCE(cb.cns09_information,0) -
            COALESCE(cb.cns10_finance,0) -
            COALESCE(cb.cns11_real_estate,0) -
            COALESCE(cb.cns12_professional,0) -
            COALESCE(cb.cns13_management,0) -
            COALESCE(cb.cns14_administrative,0), 0)), 0)::float AS other_jobs,
        COALESCE(SUM(COALESCE(cb.total_residential_units,0)), 0)::float AS res_units,
        COALESCE(SUM(COALESCE(cb.land_area_sqm,0)), 0)::float AS land_area_sqm,
        ${LAND_USES.map(
          (lu) =>
            `COALESCE(SUM(CASE WHEN cb.primary_land_use='${lu}' THEN COALESCE(cb.land_area_sqm,0) ELSE 0 END), 0)::float AS lu_${lu}_area`,
        ).join(",\n        ")}
      FROM _mta_stations_tmp m
      LEFT JOIN census_blocks cb
        ON ST_DWithin(cb.geom::geography, m.geom::geography, ${WALKSHED_M})
      GROUP BY m.sid
    `);

    const walkshedMap = new Map(walkshed.map((w) => [w.sid, w]));
    console.log(`Walkshed features computed for ${walkshed.length} stations`);

    // ── 3. Build dataset and run regressions ──
    // Merge ridership + walkshed features
    interface Row {
      office_jobs: number;
      retail_jobs: number;
      other_jobs: number;
      res_units: number;
      lu_shares: Record<string, number>;
      dominant_lu: string | null;
      windows: Record<string, number>;
    }
    const dataset: Row[] = [];
    for (const st of stations) {
      const w = walkshedMap.get(st.id);
      if (!w || w.land_area_sqm === 0) continue;
      const lu_shares: Record<string, number> = {};
      let maxShare = 0;
      let dominant_lu: string | null = null;
      for (const lu of LAND_USES) {
        const share = ((w as Record<string, number>)[`lu_${lu}_area`] ?? 0) / w.land_area_sqm;
        lu_shares[lu] = share;
        if (share > maxShare) {
          maxShare = share;
          dominant_lu = lu;
        }
      }
      if (maxShare < 0.3) dominant_lu = null; // no clear dominant
      dataset.push({
        office_jobs: w.office_jobs,
        retail_jobs: w.retail_jobs,
        other_jobs: w.other_jobs,
        res_units: w.res_units,
        lu_shares,
        dominant_lu,
        windows: st.windows,
      });
    }
    console.log(`\nDataset: ${dataset.length} stations with walkshed + ridership`);

    // Feature matrix: log-transformed employment + LU shares
    const logP = (x: number) => Math.log(Math.max(x, 0) + 1);
    const featureNames = [
      "intercept",
      "log(office_jobs)",
      "log(retail_jobs)",
      "log(other_jobs)",
      "log(res_units)",
      "lu4_mixed",
      "lu5_commercial",
      "lu7_transport",
      "lu8_public",
    ];
    const X: number[][] = dataset.map((r) => [
      1,
      logP(r.office_jobs),
      logP(r.retail_jobs),
      logP(r.other_jobs),
      logP(r.res_units),
      r.lu_shares["4"] ?? 0,
      r.lu_shares["5"] ?? 0,
      r.lu_shares["7"] ?? 0,
      r.lu_shares["8"] ?? 0,
    ]);

    // Feature summary
    console.log("\n=== Feature summary (mean ± std) ===");
    for (let j = 1; j < featureNames.length; j++) {
      const col = X.map((row) => row[j]);
      console.log(
        `  ${featureNames[j].padEnd(20)} ${mean(col).toFixed(3)} ± ${std(col).toFixed(3)}`,
      );
    }

    // Correlations
    console.log("\n=== Correlation: log(ridership) vs features, by window ===");
    console.log(
      "window  n    " + featureNames.slice(1).map((n) => n.slice(0, 8).padStart(9)).join(""),
    );
    for (const [win] of WINDOWS) {
      const y = dataset.map((r) => logP(r.windows[win]));
      const corrs = [];
      for (let j = 1; j < featureNames.length; j++) {
        corrs.push(pearson(X.map((row) => row[j]), y));
      }
      console.log(
        `${win}  ${dataset.length.toString().padStart(3)}  ` +
          corrs.map((c) => c.toFixed(3).padStart(8)).join(" "),
      );
    }

    // OLS per window
    console.log("\n=== OLS regression by time window ===");
    const coefTable: Record<string, number[]> = {};
    const r2Table: Record<string, number> = {};
    for (const [win] of WINDOWS) {
      const y = dataset.map((r) => logP(r.windows[win]));
      const { coef, r2 } = ols(X, y);
      coefTable[win] = coef;
      r2Table[win] = r2;
      console.log(`\n[${win}]  R² = ${r2.toFixed(3)}`);
      for (let j = 0; j < featureNames.length; j++) {
        console.log(`  ${featureNames[j].padEnd(20)} ${coef[j].toFixed(4)}`);
      }
    }

    // ── 4. Empirical land-use curves ──
    console.log("\n=== Empirical land-use hourly curves ===");
    console.log("(Mean ridership per window, normalized to peak for that LU)");
    const luCurves: Record<string, Record<string, number>> = {};
    const luCounts: Record<string, number> = {};
    for (const lu of LAND_USES) {
      const luStations = dataset.filter((r) => r.dominant_lu === lu);
      luCounts[lu] = luStations.length;
      if (luStations.length < 5) continue;
      const winMeans: Record<string, number> = {};
      for (const [win] of WINDOWS) {
        winMeans[win] = mean(luStations.map((r) => r.windows[win]));
      }
      const peak = Math.max(...Object.values(winMeans));
      luCurves[lu] = {};
      for (const [win] of WINDOWS) {
        luCurves[lu][win] = peak > 0 ? winMeans[win] / peak : 0;
      }
    }
    console.log(
      "\nLU  n    " + WINDOWS.map(([w]) => w.padStart(6)).join("  "),
    );
    for (const lu of LAND_USES) {
      if (!luCurves[lu]) {
        console.log(`${lu.padEnd(3)} ${(luCounts[lu] || 0).toString().padStart(3)}  (insufficient data)`);
        continue;
      }
      console.log(
        `${lu.padEnd(3)} ${luCounts[lu].toString().padStart(3)}  ` +
          WINDOWS.map(([w]) => luCurves[lu][w].toFixed(3).padStart(6)).join("  "),
      );
    }

    // ── 5. Transit activity curve ──
    console.log("\n=== Empirical transit activity curve (all stations) ===");
    const allWinMeans: Record<string, number> = {};
    for (const [win] of WINDOWS) {
      allWinMeans[win] = mean(dataset.map((r) => r.windows[win]));
    }
    const peakTransit = Math.max(...Object.values(allWinMeans));
    const CURRENT_BONUS: Record<string, number> = {
      "07-09": 1.5, "09-11": 1.0, "11-13": 1.0, "13-15": 1.0,
      "15-17": 1.1, "17-19": 1.4, "19-21": 1.1,
    };
    console.log("window  normalized  current → empirical_bonus");
    const empiricalTransitBonus: Record<string, number> = {};
    for (const [win] of WINDOWS) {
      const norm = allWinMeans[win] / peakTransit;
      const bonus = 1 + norm * 0.5;
      empiricalTransitBonus[win] = parseFloat(bonus.toFixed(2));
      console.log(
        `${win}    ${norm.toFixed(3)}      ${CURRENT_BONUS[win].toFixed(2)}  →  ${bonus.toFixed(2)}`,
      );
    }

    // ── 6. Derive refined sector weights per window ──
    console.log("\n=== Refined sector weights (from OLS elasticities) ===");
    console.log("window   office   retail   other    residential");
    const sectorWeights: Record<string, Record<string, number>> = {};
    for (const [win] of WINDOWS) {
      const c = coefTable[win];
      const raw = {
        office: Math.max(c[1], 0),
        retail: Math.max(c[2], 0),
        other: Math.max(c[3], 0),
        residential: Math.max(c[4], 0),
      };
      const total = raw.office + raw.retail + raw.other + raw.residential || 1;
      sectorWeights[win] = {
        office: raw.office / total,
        retail: raw.retail / total,
        other: raw.other / total,
        residential: raw.residential / total,
      };
      console.log(
        `${win}   ${(sectorWeights[win].office * 100).toFixed(1).padStart(5)}%   ` +
          `${(sectorWeights[win].retail * 100).toFixed(1).padStart(5)}%   ` +
          `${(sectorWeights[win].other * 100).toFixed(1).padStart(5)}%   ` +
          `${(sectorWeights[win].residential * 100).toFixed(1).padStart(5)}%`,
      );
    }

    // ── 7. Write calibration output ──
    const output = {
      calibratedAt: new Date().toISOString(),
      source: "MTA NYC Open Data - Hourly Ridership, Nov 2024 Weekdays",
      n_stations: dataset.length,
      walkshed_m: WALKSHED_M,
      regression: {
        featureNames,
        coefficients: coefTable,
        r2: r2Table,
      },
      sectorWeights,
      landUseCurves: luCurves,
      landUseCounts: luCounts,
      transitActivityCurve: Object.fromEntries(
        WINDOWS.map(([w]) => [w, allWinMeans[w] / peakTransit]),
      ),
      transitBonus: empiricalTransitBonus,
    };
    const outPath = join(process.cwd(), "app/lib/data/calibrated-demand-model.json");
    writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\n✓ Written to ${outPath}`);
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
