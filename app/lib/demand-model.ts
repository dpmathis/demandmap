import { type TimeWindow, TIME_WINDOWS } from "./constants";
import { type DemandProfileConfig, COFFEE_PROFILE } from "./profiles";

/**
 * Hourly demand multiplier curves by PLUTO land use code.
 * Empirically derived from MTA ridership data (Nov 2024 weekdays) via
 * spatial walkshed regression against census block features.
 *
 * PLUTO LandUse codes (stored without leading zeros in census_blocks):
 *   1  = One & Two Family Buildings
 *   2  = Multi-Family Walk-Up
 *   3  = Multi-Family Elevator
 *   4  = Mixed Residential & Commercial
 *   5  = Commercial & Office
 *   6  = Industrial & Manufacturing
 *   7  = Transportation & Utility
 *   8  = Public Facilities & Institutions
 *   9  = Open Space & Outdoor Recreation
 *   10 = Parking Facilities
 *   11 = Vacant Land
 *
 * Calibration: scripts/calibrate-demand-model.ts
 * Source data: app/lib/data/calibrated-demand-model.json
 */
export const LAND_USE_CURVES: Record<string, Record<TimeWindow, number>> = {
  // Residential: sharp AM peak (commuter outflow), evening return
  "1": {
    "07-09": 1.0, "09-11": 0.47, "11-13": 0.33, "13-15": 0.40,
    "15-17": 0.46, "17-19": 0.38, "19-21": 0.18,
  },
  // Multi-family walk-up: AM peak, stronger evening than single-family
  "2": {
    "07-09": 1.0, "09-11": 0.58, "11-13": 0.41, "13-15": 0.49,
    "15-17": 0.62, "17-19": 0.58, "19-21": 0.30,
  },
  // Multi-family elevator: broader curve, PM peak from density
  "3": {
    "07-09": 0.89, "09-11": 0.55, "11-13": 0.48, "13-15": 0.61,
    "15-17": 1.0, "17-19": 0.90, "19-21": 0.42,
  },
  // Mixed res/commercial: evening-dominant (dining, shopping + residents returning)
  "4": {
    "07-09": 0.46, "09-11": 0.38, "11-13": 0.39, "13-15": 0.56,
    "15-17": 0.92, "17-19": 1.0, "19-21": 0.55,
  },
  // Commercial/office: PM peak (end-of-day foot traffic)
  "5": {
    "07-09": 0.45, "09-11": 0.36, "11-13": 0.33, "13-15": 0.43,
    "15-17": 0.73, "17-19": 1.0, "19-21": 0.43,
  },
  // Industrial: bimodal — shift workers arrive AM, leave mid-afternoon
  "6": {
    "07-09": 1.0, "09-11": 0.60, "11-13": 0.51, "13-15": 0.69,
    "15-17": 0.98, "17-19": 0.82, "19-21": 0.38,
  },
  // Transportation/utility: commuter peaks (AM > PM)
  "7": {
    "07-09": 1.0, "09-11": 0.46, "11-13": 0.33, "13-15": 0.37,
    "15-17": 0.44, "17-19": 0.38, "19-21": 0.17,
  },
  // Public facilities: interpolated from regression (insufficient direct sample)
  "8": {
    "07-09": 0.50, "09-11": 0.60, "11-13": 0.70, "13-15": 0.80,
    "15-17": 0.90, "17-19": 1.0, "19-21": 0.45,
  },
  // Open space/recreation: AM peak (joggers, dog walkers), midday lull
  "9": {
    "07-09": 1.0, "09-11": 0.48, "11-13": 0.35, "13-15": 0.45,
    "15-17": 0.52, "17-19": 0.42, "19-21": 0.19,
  },
  // Parking: tracks residential pattern (arrival/departure)
  "10": {
    "07-09": 1.0, "09-11": 0.47, "11-13": 0.33, "13-15": 0.40,
    "15-17": 0.46, "17-19": 0.38, "19-21": 0.18,
  },
  // Vacant land: minimal activity
  "11": {
    "07-09": 1.0, "09-11": 0.47, "11-13": 0.40, "13-15": 0.49,
    "15-17": 0.54, "17-19": 0.39, "19-21": 0.20,
  },
};

/** Default curve for blocks without a known land use code */
export const DEFAULT_LAND_USE_CURVE: Record<TimeWindow, number> = {
  "07-09": 0.80, "09-11": 0.50, "11-13": 0.40, "13-15": 0.50,
  "15-17": 0.65, "17-19": 0.70, "19-21": 0.35,
};

/**
 * Empirical residential demand curve derived from MTA ridership.
 * Residential areas generate foot traffic mainly at AM (outbound commute)
 * and PM (return), with midday trough.
 */
const RESIDENTIAL_CURVE: Record<TimeWindow, number> = {
  "07-09": 1.0, "09-11": 0.50, "11-13": 0.35, "13-15": 0.42,
  "15-17": 0.52, "17-19": 0.50, "19-21": 0.25,
};

/**
 * Empirical sector weight curves derived from OLS regression on MTA data.
 * Shows how the relative importance of each employment sector changes by
 * time of day in explaining foot traffic.
 */
export const SECTOR_WEIGHT_CURVES: Record<TimeWindow, {
  office: number; retail: number; other: number; residential: number;
}> = {
  "07-09": { office: 0.01, retail: 0.22, other: 0.07, residential: 0.71 },
  "09-11": { office: 0.12, retail: 0.22, other: 0.07, residential: 0.59 },
  "11-13": { office: 0.15, retail: 0.24, other: 0.11, residential: 0.49 },
  "13-15": { office: 0.16, retail: 0.26, other: 0.13, residential: 0.45 },
  "15-17": { office: 0.20, retail: 0.23, other: 0.19, residential: 0.38 },
  "17-19": { office: 0.27, retail: 0.23, other: 0.16, residential: 0.34 },
  "19-21": { office: 0.22, retail: 0.28, other: 0.13, residential: 0.37 },
};

/**
 * Compute raw hourly demand for a single census block.
 * Uses empirically-calibrated sector weights that shift throughout the day:
 * - Morning: dominated by residential outflow (commuters leaving home)
 * - Midday: retail and office foot traffic grow
 * - Evening: office workers leaving, retail/dining peaks
 */
export function computeBlockDemand(
  block: {
    totalJobs: number;
    officeJobs: number;
    retailJobs: number;
    primaryLandUse: string | null;
    totalResUnits: number;
    nearestSubwayMeters: number | null;
  },
  profile: DemandProfileConfig = COFFEE_PROFILE,
): Record<TimeWindow, number> {
  const curve =
    LAND_USE_CURVES[block.primaryLandUse ?? ""] ?? DEFAULT_LAND_USE_CURVE;

  const transitThreshold = profile.transitProximityM;
  const transitBonusMap = profile.transitBonus;

  // Decompose employment sectors
  const otherJobs = Math.max(
    block.totalJobs - block.officeJobs - block.retailJobs,
    0,
  );

  const result: Partial<Record<TimeWindow, number>> = {};

  for (const tw of TIME_WINDOWS) {
    const landUseMultiplier = curve[tw];
    const transitMultiplier =
      block.nearestSubwayMeters != null &&
      block.nearestSubwayMeters <= transitThreshold
        ? (transitBonusMap[tw] ?? 1.0)
        : 1.0;

    const sw = SECTOR_WEIGHT_CURVES[tw];

    // Sector-weighted demand: each sector contributes proportionally
    const officeDemand = block.officeJobs * sw.office * landUseMultiplier;
    const retailDemand = block.retailJobs * sw.retail * landUseMultiplier;
    const otherDemand = otherJobs * sw.other * landUseMultiplier;
    const resDemand = block.totalResUnits * sw.residential * RESIDENTIAL_CURVE[tw];

    // Transit proximity amplifies all employment-derived demand
    const jobDemand = (officeDemand + retailDemand + otherDemand) * transitMultiplier;

    result[tw] = jobDemand + resDemand;
  }

  return result as Record<TimeWindow, number>;
}

// Re-export for backward compat with scripts that import these
export const TRANSIT_BONUS = COFFEE_PROFILE.transitBonus;
export const TRANSIT_PROXIMITY_THRESHOLD = COFFEE_PROFILE.transitProximityM;
