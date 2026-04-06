import type { TimeWindow } from "./constants";

/**
 * Demand profile configuration — defines how demand is computed
 * for a specific vertical (coffee, food truck, political, etc.)
 */
export interface DemandProfileConfig {
  /** Display name */
  name: string;
  /** Vertical identifier */
  vertical: string;

  /** Demand component weights (should sum to ~100) */
  componentWeights: {
    office: number;
    transit: number;
    retail: number;
    residential: number;
  };

  /** Transit proximity threshold in meters */
  transitProximityM: number;
  /** Transit bonus multipliers per time window */
  transitBonus: Record<string, number>;

  /** Residential demand multiplier (0-1) */
  residentialMultiplier: number;

  /** Opportunity scoring default weights */
  opportunityWeights: {
    supply: number;
    demand: number;
    transit: number;
  };

  /** Competitor analysis radius in meters */
  competitorRadiusM: number;

  /** Quality tier definitions */
  tiers: Array<{ name: string; score: number; color: string }>;
}

/**
 * Coffee/beverage profile — calibrated against MTA ridership data (Nov 2024).
 * Key insight: AM coffee demand is driven by residential outflow (commuters),
 * not office workers who are still in transit. Office demand kicks in mid-morning.
 * Transit bonus reflects empirical ridership peaks at commute hours.
 */
export const COFFEE_PROFILE: DemandProfileConfig = {
  name: "Coffee / Beverage",
  vertical: "food_truck",
  componentWeights: { office: 40, transit: 20, retail: 15, residential: 25 },
  transitProximityM: 200,
  transitBonus: {
    "07-09": 1.48, "09-11": 1.30, "11-13": 1.24, "13-15": 1.32,
    "15-17": 1.47, "17-19": 1.50, "19-21": 1.24,
  },
  residentialMultiplier: 0.5,
  opportunityWeights: { supply: 40, demand: 50, transit: 10 },
  competitorRadiusM: 500,
  tiers: [
    { name: "Specialty", score: 85, color: "#E85D26" },
    { name: "Premium", score: 55, color: "#028090" },
    { name: "Mainstream", score: 25, color: "#94A3B8" },
  ],
};

/**
 * Food truck profile — lunch-weighted transit bonus.
 * Food trucks peak at lunch (11-14) near offices and transit hubs.
 */
export const FOOD_TRUCK_PROFILE: DemandProfileConfig = {
  name: "Food Truck",
  vertical: "food_truck",
  componentWeights: { office: 35, transit: 20, retail: 25, residential: 20 },
  transitProximityM: 300,
  transitBonus: {
    "07-09": 1.20, "09-11": 1.25, "11-13": 1.40, "13-15": 1.35,
    "15-17": 1.30, "17-19": 1.40, "19-21": 1.24,
  },
  residentialMultiplier: 0.5,
  opportunityWeights: { supply: 35, demand: 40, transit: 25 },
  competitorRadiusM: 400,
  tiers: [
    { name: "Gourmet", score: 85, color: "#E85D26" },
    { name: "Standard", score: 50, color: "#028090" },
    { name: "Fast Casual", score: 25, color: "#94A3B8" },
  ],
};

/**
 * Political canvass profile — evening-weighted for when residents are home.
 * Transit bonus calibrated from MTA PM peak when commuters return.
 */
export const POLITICAL_PROFILE: DemandProfileConfig = {
  name: "Political Canvass",
  vertical: "political",
  componentWeights: { office: 10, transit: 10, retail: 10, residential: 70 },
  transitProximityM: 500,
  transitBonus: {
    "07-09": 1.0, "09-11": 1.0, "11-13": 1.0, "13-15": 1.0,
    "15-17": 1.30, "17-19": 1.50, "19-21": 1.24,
  },
  residentialMultiplier: 0.8,
  opportunityWeights: { supply: 20, demand: 60, transit: 20 },
  competitorRadiusM: 1000,
  tiers: [
    { name: "High Priority", score: 85, color: "#DC2626" },
    { name: "Medium Priority", score: 50, color: "#F59E0B" },
    { name: "Low Priority", score: 25, color: "#94A3B8" },
  ],
};

/**
 * Retail pop-up profile — afternoon/evening weighted.
 * MTA data shows mixed-use and commercial areas peak 15:00-19:00.
 */
export const RETAIL_POPUP_PROFILE: DemandProfileConfig = {
  name: "Retail Pop-Up",
  vertical: "retail_popup",
  componentWeights: { office: 25, transit: 20, retail: 35, residential: 20 },
  transitProximityM: 250,
  transitBonus: {
    "07-09": 1.10, "09-11": 1.25, "11-13": 1.30, "13-15": 1.32,
    "15-17": 1.47, "17-19": 1.50, "19-21": 1.24,
  },
  residentialMultiplier: 0.5,
  opportunityWeights: { supply: 35, demand: 45, transit: 20 },
  competitorRadiusM: 600,
  tiers: [
    { name: "Premium", score: 85, color: "#8B5CF6" },
    { name: "Mid-Range", score: 50, color: "#3B82F6" },
    { name: "Budget", score: 25, color: "#94A3B8" },
  ],
};

/** All preset profiles indexed by vertical key */
export const PRESET_PROFILES: Record<string, DemandProfileConfig> = {
  coffee: COFFEE_PROFILE,
  food_truck: FOOD_TRUCK_PROFILE,
  political: POLITICAL_PROFILE,
  retail_popup: RETAIL_POPUP_PROFILE,
};

/** Get a profile by vertical key, with coffee as fallback */
export function getProfile(vertical?: string | null): DemandProfileConfig {
  return PRESET_PROFILES[vertical || "coffee"] ?? COFFEE_PROFILE;
}
