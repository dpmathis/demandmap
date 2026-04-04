/**
 * Compute composite station busyness score from historical baseline
 * and real-time train arrival data.
 */

/**
 * Compute a 0-100 busyness score for a station.
 *
 * @param baselinePctile - Percentile rank (0-1) of this station's historical
 *   ridership for the current day-of-week and hour, relative to all stations.
 * @param realtimeArrivals - Number of trains arriving at this station in the
 *   next 10 minutes (from GTFS-RT).
 * @param maxArrivals - Cap for normalizing arrival counts. Major hubs like
 *   Times Square see ~15 arrivals per 10 minutes.
 * @returns Score from 0 (quiet) to 100 (very busy).
 */
export function computeBusyness(
  baselinePctile: number,
  realtimeArrivals: number,
  maxArrivals = 15
): number {
  const rtNorm = Math.min(1, realtimeArrivals / maxArrivals);
  return Math.round((0.7 * baselinePctile + 0.3 * rtNorm) * 100);
}
