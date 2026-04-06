export const TIME_WINDOWS = [
  "07-09", "09-11", "11-13", "13-15", "15-17", "17-19", "19-21",
] as const;

export type TimeWindow = (typeof TIME_WINDOWS)[number];

export const TIME_WINDOW_LABELS: Record<TimeWindow, string> = {
  "07-09": "7 – 9 AM",
  "09-11": "9 – 11 AM",
  "11-13": "11 AM – 1 PM",
  "13-15": "1 – 3 PM",
  "15-17": "3 – 5 PM",
  "17-19": "5 – 7 PM",
  "19-21": "7 – 9 PM",
};

export const DEFAULT_TIME_WINDOW: TimeWindow = "09-11";

export const NYC_CENTER: [number, number] = [-74.006, 40.7128];
export const NYC_DEFAULT_ZOOM = 11;
export const ZOOM_BLOCK = 14;

export const VERTICALS = [
  { value: "coffee", label: "Coffee / Beverage" },
  { value: "food_truck", label: "Food Truck" },
  { value: "retail", label: "Retail Pop-Up" },
  { value: "political", label: "Political Canvass" },
  { value: "events", label: "Event Planning" },
  { value: "custom", label: "Custom" },
] as const;

export interface OpportunityWeights {
  supply: number;
  demand: number;
  transit: number;
}

export const DEFAULT_WEIGHTS: OpportunityWeights = {
  supply: 40,
  demand: 50,
  transit: 10,
};

export const COLOR_MODES = ["demand", "gap", "competitors", "transit"] as const;
export type ColorMode = (typeof COLOR_MODES)[number];

export const COLOR_MODE_LABELS: Record<ColorMode, string> = {
  demand: "Demand Score",
  gap: "Opportunity Gap",
  competitors: "Competitor Density",
  transit: "Transit Access",
};
