import type { OpportunityWeights } from "./constants";

/**
 * Recompute a weighted opportunity score client-side using
 * the raw sub-scores from the API response.
 */
export function computeWeightedScore(
  props: {
    supplyScore: number | null;
    gapScore: number | null;
    demandScore: number | null;
    nearestSubwayMeters: number | null;
  },
  weights: OpportunityWeights
): number | null {
  const supply = props.supplyScore ?? props.gapScore;
  const demand = props.demandScore;
  if (supply == null || demand == null) return null;

  const totalWeight = weights.supply + weights.demand + weights.transit;
  if (totalWeight === 0) return 0;

  // Transit score: 100 if within 300m, scaled down to 0 at 2000m
  const transitScore =
    props.nearestSubwayMeters != null
      ? Math.max(0, 100 - (props.nearestSubwayMeters / 2000) * 100)
      : 0;

  const raw =
    (supply * weights.supply +
      demand * weights.demand +
      transitScore * weights.transit) /
    totalWeight;

  return Math.max(0, Math.min(100, Math.round(raw * 100) / 100));
}
