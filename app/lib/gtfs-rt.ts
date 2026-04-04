/**
 * GTFS-RT feed parser for MTA subway real-time train arrivals.
 *
 * Fetches all 8 MTA subway GTFS-RT feeds, counts upcoming arrivals per station
 * in a rolling window, and maps them to station_complex_ids.
 *
 * Results are cached in-memory with a 30-second TTL.
 */
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import stopToComplex from "./data/gtfs-stop-to-complex.json";

const { transit_realtime } = GtfsRealtimeBindings;

const CACHE_TTL_MS = 30_000;
const ARRIVAL_WINDOW_SECONDS = 600; // next 10 minutes
const FEED_TIMEOUT_MS = 10_000;

const GTFS_RT_FEEDS = [
  "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs",
  "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace",
  "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm",
  "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g",
  "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz",
  "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l",
  "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw",
  "https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-si",
];

const stopMapping = stopToComplex as Record<string, string>;

let cache: {
  arrivals: Map<string, number>; // stationComplexId -> arrival count
  fetchedAt: number;
} | null = null;

async function fetchFeed(url: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  const res = await fetch(url, { signal: AbortSignal.timeout(FEED_TIMEOUT_MS) });
  if (!res.ok) return counts;

  const buffer = await res.arrayBuffer();
  const feed = transit_realtime.FeedMessage.decode(new Uint8Array(buffer));
  const now = Math.floor(Date.now() / 1000);
  const windowEnd = now + ARRIVAL_WINDOW_SECONDS;

  for (const entity of feed.entity) {
    if (!entity.tripUpdate?.stopTimeUpdate) continue;

    for (const stu of entity.tripUpdate.stopTimeUpdate) {
      const arrivalTime = stu.arrival?.time
        ? typeof stu.arrival.time === "number"
          ? stu.arrival.time
          : Number(stu.arrival.time)
        : null;

      if (arrivalTime === null || arrivalTime < now || arrivalTime > windowEnd) continue;

      const stopId = stu.stopId;
      if (!stopId) continue;

      const complexId = stopMapping[stopId];
      if (!complexId) continue;

      counts.set(complexId, (counts.get(complexId) || 0) + 1);
    }
  }

  return counts;
}

/**
 * Get the number of upcoming train arrivals per station complex.
 * Returns a Map of stationComplexId -> arrival count in the next 10 minutes.
 * Results are cached for 30 seconds.
 */
export async function getStationArrivals(): Promise<Map<string, number>> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.arrivals;
  }

  const results = await Promise.allSettled(GTFS_RT_FEEDS.map(fetchFeed));
  const merged = new Map<string, number>();

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const [complexId, count] of result.value) {
        merged.set(complexId, (merged.get(complexId) || 0) + count);
      }
    }
  }

  cache = { arrivals: merged, fetchedAt: Date.now() };
  return merged;
}
