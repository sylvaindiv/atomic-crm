export type GeoPoint = { lat: number; lng: number };

// v2: bumped to drop entries cached by an earlier version that could
// permanently cache a `null` on a network failure, not just a real "no match".
const CACHE_PREFIX = "map-geocode:v2:";

const cacheKey = (postalCode: string, city: string) =>
  `${CACHE_PREFIX}${postalCode}|${city}`;

const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY_MS = 500;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ponytail: one HTTP request per uncached postal_code+city pair (throttled to
// a handful in flight at once by useGeocodedContacts, no server-side batching,
// plus a short backoff on 429s below). Fine at this CRM's scale (hundreds of
// contacts); switch to the API's batch CSV endpoint or a persisted lat/lng
// column if the contact list grows much larger.
export const geocodeAddress = async (
  postalCode: string,
  city: string,
): Promise<GeoPoint | null> => {
  const key = cacheKey(postalCode, city);
  const cached = localStorage.getItem(key);
  if (cached !== null) {
    return JSON.parse(cached);
  }

  // IGN Géoplateforme geocoding (same BAN data, same GeoJSON response shape
  // as the now-decommissioned api-adresse.data.gouv.fr).
  const url = `https://data.geopf.fr/geocodage/search?q=${encodeURIComponent(
    city,
  )}&postcode=${encodeURIComponent(postalCode)}&limit=1`;

  let response: Response;
  for (let attempt = 0; ; attempt++) {
    try {
      response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch {
      // Network error / timeout: don't cache, so the next visit retries
      // instead of being stuck with a permanent false "not found".
      return null;
    }

    if (response.status !== 429 || attempt >= RATE_LIMIT_RETRIES) {
      break;
    }
    await sleep(RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt);
  }

  if (!response.ok) {
    // Includes a 429 that's still failing after retries: don't cache, so a
    // later visit (once the rate limit has cooled down) retries instead of
    // being stuck with a permanent false "not found".
    return null;
  }

  const data = await response.json();
  const coordinates = data?.features?.[0]?.geometry?.coordinates;
  const point =
    Array.isArray(coordinates) && coordinates.length === 2
      ? { lat: coordinates[1], lng: coordinates[0] }
      : null;

  // Only cache a real answer from the API (found or genuinely no match),
  // never a network failure.
  localStorage.setItem(key, JSON.stringify(point));
  return point;
};
