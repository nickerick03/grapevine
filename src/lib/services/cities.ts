const NOMINATIM_SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const CITY_CACHE_TTL_MS = 1000 * 60 * 60 * 12;

type NominatimCityEntry = {
  display_name?: string;
  type?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    county?: string;
    state?: string;
    country?: string;
  };
};

type CityCacheEntry = {
  expiresAt: number;
  results: string[];
};

const cityCache = new Map<string, CityCacheEntry>();

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function mapCityLabel(entry: NominatimCityEntry): string | null {
  const city =
    entry.address?.city
    ?? entry.address?.town
    ?? entry.address?.village
    ?? entry.address?.municipality
    ?? entry.display_name?.split(",")[0]?.trim()
    ?? "";
  const state = entry.address?.state?.trim() ?? "";
  const country = entry.address?.country?.trim() ?? "";

  const cityName = city.trim();
  if (!cityName) {
    return null;
  }

  if (country && state && state.toLowerCase() !== cityName.toLowerCase()) {
    return `${cityName}, ${state}, ${country}`;
  }

  if (country) {
    return `${cityName}, ${country}`;
  }

  return cityName;
}

async function fetchCities(query: string, featureType?: "city" | "settlement", signal?: AbortSignal): Promise<string[]> {
  const url = new URL(NOMINATIM_SEARCH_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("dedupe", "1");
  url.searchParams.set("limit", "12");
  url.searchParams.set("featureType", featureType ?? "city");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`City search failed (${response.status}).`);
  }

  const payload = (await response.json()) as NominatimCityEntry[];
  const unique = new Set<string>();

  for (const row of payload) {
    const label = mapCityLabel(row);
    if (!label) {
      continue;
    }
    unique.add(label);
  }

  return Array.from(unique);
}

export async function searchWorldCities(query: string, signal?: AbortSignal): Promise<string[]> {
  const normalized = normalizeQuery(query);
  if (normalized.length < 2) {
    return [];
  }

  const cached = cityCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  let results = await fetchCities(normalized, "city", signal);
  if (results.length === 0) {
    results = await fetchCities(normalized, "settlement", signal);
  }

  cityCache.set(normalized, {
    results,
    expiresAt: Date.now() + CITY_CACHE_TTL_MS,
  });

  return results;
}
