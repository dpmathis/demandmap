import { type TimeWindow, TIME_WINDOWS } from "./constants";
import { type DemandProfileConfig, COFFEE_PROFILE } from "./profiles";

/**
 * Hourly demand multiplier curves by PLUTO land use code.
 * These are the default curves — profiles can override via config.
 *
 * PLUTO LandUse codes:
 *   01 = One & Two Family Buildings
 *   02 = Multi-Family Walk-Up
 *   03 = Multi-Family Elevator
 *   04 = Mixed Residential & Commercial
 *   05 = Commercial & Office
 *   06 = Industrial & Manufacturing
 *   07 = Transportation & Utility
 *   08 = Public Facilities & Institutions
 *   09 = Open Space & Outdoor Recreation
 *   10 = Parking Facilities
 *   11 = Vacant Land
 */
export const LAND_USE_CURVES: Record<string, Record<TimeWindow, number>> = {
  "01": {
    "07-09": 0.3, "09-11": 0.1, "11-13": 0.2, "13-15": 0.1,
    "15-17": 0.2, "17-19": 0.3, "19-21": 0.2,
  },
  "02": {
    "07-09": 0.4, "09-11": 0.1, "11-13": 0.2, "13-15": 0.1,
    "15-17": 0.2, "17-19": 0.4, "19-21": 0.3,
  },
  "03": {
    "07-09": 0.4, "09-11": 0.1, "11-13": 0.2, "13-15": 0.1,
    "15-17": 0.2, "17-19": 0.4, "19-21": 0.3,
  },
  "04": {
    "07-09": 0.5, "09-11": 0.7, "11-13": 1.0, "13-15": 0.8,
    "15-17": 0.6, "17-19": 0.7, "19-21": 0.5,
  },
  "05": {
    "07-09": 0.4, "09-11": 1.0, "11-13": 0.9, "13-15": 0.8,
    "15-17": 0.7, "17-19": 0.3, "19-21": 0.1,
  },
  "06": {
    "07-09": 0.3, "09-11": 0.5, "11-13": 0.6, "13-15": 0.5,
    "15-17": 0.4, "17-19": 0.2, "19-21": 0.1,
  },
  "07": {
    "07-09": 1.0, "09-11": 0.3, "11-13": 0.4, "13-15": 0.3,
    "15-17": 0.5, "17-19": 1.0, "19-21": 0.4,
  },
  "08": {
    "07-09": 0.3, "09-11": 0.7, "11-13": 0.8, "13-15": 0.7,
    "15-17": 0.5, "17-19": 0.3, "19-21": 0.1,
  },
  "09": {
    "07-09": 0.2, "09-11": 0.3, "11-13": 0.5, "13-15": 0.4,
    "15-17": 0.3, "17-19": 0.3, "19-21": 0.2,
  },
  "10": {
    "07-09": 0.2, "09-11": 0.1, "11-13": 0.2, "13-15": 0.1,
    "15-17": 0.1, "17-19": 0.2, "19-21": 0.1,
  },
  "11": {
    "07-09": 0.0, "09-11": 0.0, "11-13": 0.0, "13-15": 0.0,
    "15-17": 0.0, "17-19": 0.0, "19-21": 0.0,
  },
};

/** Default curve for blocks without a known land use code */
export const DEFAULT_LAND_USE_CURVE: Record<TimeWindow, number> = {
  "07-09": 0.3, "09-11": 0.5, "11-13": 0.6, "13-15": 0.5,
  "15-17": 0.4, "17-19": 0.3, "19-21": 0.2,
};

/** Default residential demand curve (by time window) */
const RESIDENTIAL_CURVE: Record<TimeWindow, number> = {
  "07-09": 0.4, "09-11": 0.1, "11-13": 0.1, "13-15": 0.1,
  "15-17": 0.1, "17-19": 0.3, "19-21": 0.3,
};

/**
 * Compute raw hourly demand for a single census block.
 * Accepts an optional profile config to override defaults.
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
  profile: DemandProfileConfig = COFFEE_PROFILE
): Record<TimeWindow, number> {
  const curve =
    LAND_USE_CURVES[block.primaryLandUse ?? ""] ?? DEFAULT_LAND_USE_CURVE;

  const officeWeight =
    block.totalJobs > 0 ? block.officeJobs / block.totalJobs : 0;

  const transitThreshold = profile.transitProximityM;
  const transitBonusMap = profile.transitBonus;
  const resMult = profile.residentialMultiplier;

  const result: Partial<Record<TimeWindow, number>> = {};

  for (const tw of TIME_WINDOWS) {
    const landUseMultiplier = curve[tw];
    const transitMultiplier =
      block.nearestSubwayMeters != null &&
      block.nearestSubwayMeters <= transitThreshold
        ? (transitBonusMap[tw] ?? 1.0)
        : 1.0;

    // Office-sector demand: jobs weighted by office fraction and land use curve
    const officeDemand =
      block.totalJobs * officeWeight * landUseMultiplier * transitMultiplier;

    // Residential demand: contribution scaled by profile multiplier
    const resDemand = block.totalResUnits * RESIDENTIAL_CURVE[tw] * resMult;

    result[tw] = officeDemand + resDemand;
  }

  return result as Record<TimeWindow, number>;
}

// Re-export for backward compat with scripts that import these
export const TRANSIT_BONUS = COFFEE_PROFILE.transitBonus;
export const TRANSIT_PROXIMITY_THRESHOLD = COFFEE_PROFILE.transitProximityM;
