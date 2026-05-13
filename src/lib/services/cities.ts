const NOMINATIM_SEARCH_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const OPEN_METEO_GEOCODING_ENDPOINT = "https://geocoding-api.open-meteo.com/v1/search";
const CITY_CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const CITY_RESULT_LIMIT = 12;

type NominatimCityEntry = {
  display_name?: string;
  type?: string;
  addresstype?: string;
  category?: string;
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

type OpenMeteoCityEntry = {
  name?: string;
  admin1?: string;
  country?: string;
  feature_code?: string;
  population?: number;
};

type OpenMeteoCityResponse = {
  results?: OpenMeteoCityEntry[];
};

type CityCacheEntry = {
  expiresAt: number;
  results: string[];
};

const cityCache = new Map<string, CityCacheEntry>();

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeForMatching(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function getPrimaryCityLabel(label: string): string {
  return label.split(",")[0]?.trim() ?? label.trim();
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

function mapOpenMeteoCityLabel(entry: OpenMeteoCityEntry): string | null {
  const name = entry.name?.trim() ?? "";
  if (!name) {
    return null;
  }

  const admin1 = entry.admin1?.trim() ?? "";
  const country = entry.country?.trim() ?? "";
  const parts = [name];

  if (admin1 && normalizeForMatching(admin1) !== normalizeForMatching(name)) {
    parts.push(admin1);
  }
  if (country) {
    parts.push(country);
  }

  return parts.join(", ");
}

function scoreCityLabel(label: string, normalizedQuery: string): number {
  const normalizedLabel = normalizeForMatching(label);
  if (!normalizedLabel) {
    return -1;
  }

  const normalizedPrimary = normalizeForMatching(getPrimaryCityLabel(label));

  if (normalizedPrimary === normalizedQuery) {
    return 500;
  }
  if (normalizedPrimary.startsWith(normalizedQuery)) {
    return 450 - Math.min(60, normalizedPrimary.length - normalizedQuery.length);
  }
  if (normalizedLabel.startsWith(normalizedQuery)) {
    return 420;
  }
  if (normalizedPrimary.includes(normalizedQuery)) {
    return 320;
  }
  if (normalizedLabel.includes(normalizedQuery)) {
    return 250;
  }
  return -1;
}

function rankAndLimitCities(labels: string[], query: string): string[] {
  const normalizedQuery = normalizeForMatching(query);
  if (!normalizedQuery) {
    return [];
  }

  const seen = new Set<string>();
  const ranked: Array<{ label: string; score: number }> = [];

  for (const label of labels) {
    const trimmed = label.trim();
    if (!trimmed) {
      continue;
    }

    const dedupeKey = normalizeForMatching(trimmed);
    if (!dedupeKey || seen.has(dedupeKey)) {
      continue;
    }

    const score = scoreCityLabel(trimmed, normalizedQuery);
    if (score < 0) {
      continue;
    }

    seen.add(dedupeKey);
    ranked.push({ label: trimmed, score });
  }

  ranked.sort((a, b) => {
    if (a.score !== b.score) {
      return b.score - a.score;
    }
    return a.label.localeCompare(b.label);
  });

  return ranked.slice(0, CITY_RESULT_LIMIT).map((entry) => entry.label);
}

async function fetchNominatimCities(query: string, featureType?: "city" | "settlement", signal?: AbortSignal): Promise<string[]> {
  const url = new URL(NOMINATIM_SEARCH_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("dedupe", "1");
  url.searchParams.set("limit", String(CITY_RESULT_LIMIT));
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

function isRelevantOpenMeteoFeature(entry: OpenMeteoCityEntry): boolean {
  const code = entry.feature_code?.trim().toUpperCase() ?? "";
  return code.startsWith("PPL") || code === "STLMT";
}

async function fetchOpenMeteoCities(query: string, signal?: AbortSignal): Promise<string[]> {
  const url = new URL(OPEN_METEO_GEOCODING_ENDPOINT);
  url.searchParams.set("name", query);
  url.searchParams.set("count", "24");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    signal,
  });

  if (!response.ok) {
    throw new Error(`City fallback search failed (${response.status}).`);
  }

  const payload = (await response.json()) as OpenMeteoCityResponse;
  const unique = new Set<string>();
  const ranked = (payload.results ?? [])
    .filter(isRelevantOpenMeteoFeature)
    .sort((a, b) => (b.population ?? 0) - (a.population ?? 0));

  for (const row of ranked) {
    const label = mapOpenMeteoCityLabel(row);
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

  let results: string[] = [];
  try {
    results = await fetchNominatimCities(normalized, "city", signal);
    if (results.length === 0) {
      results = await fetchNominatimCities(normalized, "settlement", signal);
    }
  } catch {
    results = [];
  }

  let ranked = rankAndLimitCities(results, normalized);
  if (ranked.length === 0) {
    try {
      const fallbackResults = await fetchOpenMeteoCities(normalized, signal);
      ranked = rankAndLimitCities(fallbackResults, normalized);
    } catch {
      // Keep Nominatim-only results when fallback lookup is unavailable.
    }
  }

  cityCache.set(normalized, {
    results: ranked,
    expiresAt: Date.now() + CITY_CACHE_TTL_MS,
  });

  return ranked;
}
