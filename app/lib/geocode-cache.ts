/**
 * Server-side geocoding cache using Nominatim (OpenStreetMap).
 * Caches results for 24 hours to minimize API calls.
 * Rate limit: 1 request/second (Nominatim policy).
 */

const ONE_DAY_MS = 86_400_000;

interface CacheEntry {
  lng: number;
  lat: number;
  expires: number;
}

const cache = new Map<string, CacheEntry | null>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, val] of cache) {
    if (val && val.expires < now) cache.delete(key);
    else if (val === null) cache.delete(key);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Simplify NYC event-style addresses for Nominatim.
 * NYC permits use formats like "2 AVENUE between EAST 32 STREET and EAST 33 STREET".
 * Nominatim can't handle intersections but works with single streets + borough.
 * Extract the cross-street (more specific) and append Manhattan/borough.
 */
function simplifyAddress(raw: string): string {
  // "X between Y and Z" → use "Y, Manhattan" (the cross-street is more specific)
  const betweenMatch = raw.match(/^(.+?)\s+between\s+(.+?)\s+and\s+/i);
  if (betweenMatch) {
    return `${betweenMatch[2]}, Manhattan`;
  }
  // "X from Y to Z" → use "Y, Manhattan"
  const fromMatch = raw.match(/^(.+?)\s+from\s+(.+?)\s+to\s+/i);
  if (fromMatch) {
    return `${fromMatch[2]}, Manhattan`;
  }
  return raw;
}

/**
 * Geocode an NYC address using Nominatim (OpenStreetMap).
 * Results are cached for 24 hours. Returns null if geocoding fails.
 */
export async function geocodeAddress(
  address: string
): Promise<{ lng: number; lat: number } | null> {
  const key = address.toLowerCase().trim();
  if (!key) return null;

  const cached = cache.get(key);
  if (cached !== undefined) {
    if (cached === null) return null;
    if (cached.expires > Date.now()) return { lng: cached.lng, lat: cached.lat };
    cache.delete(key);
  }

  try {
    const simplified = simplifyAddress(address);
    const encoded = encodeURIComponent(`${simplified}, New York, NY`);
    // Use structured search for better results with NYC addresses
    const url =
      `https://nominatim.openstreetmap.org/search` +
      `?q=${encoded}` +
      `&format=jsonv2` +
      `&limit=1` +
      `&countrycodes=us`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "DemandMap/1.0" },
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.length) {
      cache.set(key, null);
      return null;
    }

    const lng = parseFloat(data[0].lon);
    const lat = parseFloat(data[0].lat);
    if (isNaN(lng) || isNaN(lat)) return null;

    cache.set(key, { lng, lat, expires: Date.now() + ONE_DAY_MS });
    return { lng, lat };
  } catch {
    return null;
  }
}

/**
 * Geocode multiple addresses sequentially with rate limiting.
 * Nominatim allows 1 request/second, so we add delays between calls.
 * Cached addresses skip the delay.
 */
export async function geocodeBatch(
  addresses: string[]
): Promise<Map<string, { lng: number; lat: number }>> {
  pruneExpired();

  const results = new Map<string, { lng: number; lat: number }>();
  let lastFetchTime = 0;

  for (const addr of addresses) {
    // Check cache first (no delay needed)
    const key = addr.toLowerCase().trim();
    const cached = cache.get(key);
    if (cached !== undefined) {
      if (cached && cached.expires > Date.now()) {
        results.set(addr, { lng: cached.lng, lat: cached.lat });
        continue;
      }
    }

    // Rate limit: ensure 1 second between actual API calls
    const elapsed = Date.now() - lastFetchTime;
    if (elapsed < 1100) {
      await delay(1100 - elapsed);
    }

    const result = await geocodeAddress(addr);
    lastFetchTime = Date.now();

    if (result) {
      results.set(addr, result);
    }
  }

  return results;
}
