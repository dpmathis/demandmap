import { TTLCache } from "@/app/lib/cache";

const ONE_HOUR = 60 * 60 * 1000;
const cache = new TTLCache<GeoJSON.FeatureCollection>();

interface SocrataEvent {
  event_name?: string;
  event_type?: string;
  start_date_time?: string;
  end_date_time?: string;
  event_location?: string;
  event_borough?: string;
  event_agency?: string;
  event_street_side?: string;
  // Some Socrata datasets ship coordinates directly
  latitude?: string;
  longitude?: string;
}

// NYC Open Data: Street Event Permits
const SOCRATA_ENDPOINT =
  "https://data.cityofnewyork.us/resource/tvpp-9vvx.json";

// Borough centroids (lat, lng)
const BOROUGH_CENTROIDS: Record<string, [number, number]> = {
  Manhattan: [40.7831, -73.9712],
  Brooklyn: [40.6782, -73.9442],
  Queens: [40.7282, -73.7949],
  Bronx: [40.8448, -73.8648],
  "Staten Island": [40.5795, -74.1502],
};

// Deterministic hash → 0..1
function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 10000) / 10000;
}

function approxCoordsFor(location: string, borough: string): [number, number] | null {
  const centroid = BOROUGH_CENTROIDS[borough];
  if (!centroid) return null;
  // Jitter within ~3km of borough centroid using location string as seed
  const h1 = hash01(location);
  const h2 = hash01(location + "salt");
  const dLat = (h1 - 0.5) * 0.05; // ~±2.8km lat
  const dLng = (h2 - 0.5) * 0.06; // ~±2.5km lng
  return [centroid[0] + dLat, centroid[1] + dLng];
}

export async function getNYCEvents(): Promise<GeoJSON.FeatureCollection> {
  const cached = cache.get("events");
  if (cached) return cached;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const url = `${SOCRATA_ENDPOINT}?$where=start_date_time >= '${today}T00:00:00' AND start_date_time <= '${today}T23:59:59'&$limit=200`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return emptyCollection();

    const events: SocrataEvent[] = await res.json();
    if (!events.length) return emptyCollection();

    const features: GeoJSON.Feature[] = [];
    for (const event of events) {
      // Try native coordinates first
      let lng: number | null = null;
      let lat: number | null = null;
      if (event.longitude && event.latitude) {
        const lngN = parseFloat(event.longitude);
        const latN = parseFloat(event.latitude);
        if (!isNaN(lngN) && !isNaN(latN)) { lng = lngN; lat = latN; }
      }
      // Fall back to borough centroid + deterministic jitter
      if (lng == null || lat == null) {
        const borough = event.event_borough ?? "Manhattan";
        const seed = event.event_location ?? event.event_name ?? "";
        const approx = approxCoordsFor(seed, borough);
        if (!approx) continue;
        lat = approx[0];
        lng = approx[1];
      }

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          name: event.event_name ?? "Unknown Event",
          type: event.event_type ?? "",
          borough: event.event_borough ?? "",
          startTime: event.start_date_time ?? "",
          endTime: event.end_date_time ?? "",
          location: event.event_location ?? "",
        },
      });
    }

    const collection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features,
    };

    cache.set("events", collection, ONE_HOUR);
    return collection;
  } catch {
    return emptyCollection();
  }
}

function emptyCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
