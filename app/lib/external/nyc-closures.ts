import { TTLCache } from "@/app/lib/cache";

const FIFTEEN_MIN = 15 * 60 * 1000;
const cache = new TTLCache<GeoJSON.FeatureCollection>();

interface SocrataClosure {
  onstreetname?: string;
  fromstreetname?: string;
  tostreetname?: string;
  work_start_date?: string;
  work_end_date?: string;
  purpose?: string;
  borough?: string;
  // Some Socrata datasets ship coordinates
  the_geom?: { type: string; coordinates: number[] };
  latitude?: string;
  longitude?: string;
}

// NYC Open Data: Street Closures due to construction activities
const SOCRATA_ENDPOINT =
  "https://data.cityofnewyork.us/resource/478a-yykk.json";

// Borough centroids (lat, lng)
const BOROUGH_CENTROIDS: Record<string, [number, number]> = {
  MANHATTAN: [40.7831, -73.9712],
  BROOKLYN: [40.6782, -73.9442],
  QUEENS: [40.7282, -73.7949],
  BRONX: [40.8448, -73.8648],
  "STATEN ISLAND": [40.5795, -74.1502],
};

function hash01(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 10000) / 10000;
}

function approxCoordsFor(streetLabel: string, borough: string): [number, number] | null {
  const centroid = BOROUGH_CENTROIDS[borough.toUpperCase()];
  if (!centroid) return null;
  const h1 = hash01(streetLabel);
  const h2 = hash01(streetLabel + "salt");
  const dLat = (h1 - 0.5) * 0.05;
  const dLng = (h2 - 0.5) * 0.06;
  return [centroid[0] + dLat, centroid[1] + dLng];
}

export async function getNYCClosures(): Promise<GeoJSON.FeatureCollection> {
  const cached = cache.get("closures");
  if (cached) return cached;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const url = `${SOCRATA_ENDPOINT}?$where=work_start_date <= '${today}T23:59:59' AND work_end_date >= '${today}T00:00:00'&$limit=200`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return emptyCollection();

    const closures: SocrataClosure[] = await res.json();
    if (!closures.length) return emptyCollection();

    const features: GeoJSON.Feature[] = [];
    for (const c of closures) {
      let lng: number | null = null;
      let lat: number | null = null;

      // Try native geometry
      if (c.the_geom?.coordinates?.length === 2) {
        lng = c.the_geom.coordinates[0];
        lat = c.the_geom.coordinates[1];
      } else if (c.longitude && c.latitude) {
        const lngN = parseFloat(c.longitude);
        const latN = parseFloat(c.latitude);
        if (!isNaN(lngN) && !isNaN(latN)) { lng = lngN; lat = latN; }
      }

      // Fall back to borough centroid + deterministic jitter
      if (lng == null || lat == null) {
        const borough = c.borough ?? "MANHATTAN";
        const label = [c.onstreetname, c.fromstreetname, c.tostreetname]
          .filter(Boolean)
          .join("|");
        if (!label) continue;
        const approx = approxCoordsFor(label, borough);
        if (!approx) continue;
        lat = approx[0];
        lng = approx[1];
      }

      features.push({
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          street: c.onstreetname ?? "",
          from: c.fromstreetname ?? "",
          to: c.tostreetname ?? "",
          purpose: c.purpose ?? "Construction",
          borough: c.borough ?? "",
          startDate: c.work_start_date ?? "",
          endDate: c.work_end_date ?? "",
        },
      });
    }

    const collection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features,
    };

    cache.set("closures", collection, FIFTEEN_MIN);
    return collection;
  } catch {
    return emptyCollection();
  }
}

function emptyCollection(): GeoJSON.FeatureCollection {
  return { type: "FeatureCollection", features: [] };
}
