import type { Pub } from "@/app/components/vibe";
import { haversineKm } from "@/app/components/filtering";
import type { VenueType } from "@/types/place";

const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const NOMINATIM_ENDPOINT = "https://nominatim.openstreetmap.org/search";
const CACHE_TTL_MS = 180_000;
const cache = new Map<string, { expiresAt: number; data: OsmPlaceResult[] }>();

export interface OsmSearchInput {
  center: { lat: number; lng: number };
  radiusKm: number;
  bounds?: { north: number; south: number; east: number; west: number };
  query?: string;
  city?: string;
  country?: string;
  countryCode?: string;
  signal?: AbortSignal;
  overpassTimeoutSec?: number;
}

export interface OsmProgressiveSearchResult {
  results: OsmPlaceResult[];
  scope: "radius" | "country" | "global";
}

export interface OsmPlaceResult {
  sourceProvider: "osm";
  sourcePlaceId: string;
  osmType: "node" | "way" | "relation";
  name: string;
  category: string;
  venueType: VenueType;
  address: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  imageUrl: string | null;
  openingHours: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  tags: Record<string, string>;
}

type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

type NominatimEntry = {
  place_id: number;
  osm_type?: "node" | "way" | "relation";
  osm_id?: number;
  lat: string;
  lon: string;
  class?: string;
  type?: string;
  display_name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    suburb?: string;
    country?: string;
    country_code?: string;
    road?: string;
    house_number?: string;
  };
  extratags?: Record<string, string>;
};

const AMENITY_TYPES = new Set(["pub", "bar", "biergarten", "nightclub", "restaurant", "fast_food", "cafe"]);
const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  hungary: "hu",
  austria: "at",
  germany: "de",
  czechia: "cz",
  "czech republic": "cz",
  portugal: "pt",
  slovakia: "sk",
  romania: "ro",
  croatia: "hr",
  serbia: "rs",
  slovenia: "si",
  poland: "pl",
  italy: "it",
  france: "fr",
  spain: "es",
  "united kingdom": "gb",
  uk: "gb",
  ireland: "ie",
  netherlands: "nl",
  belgium: "be",
  switzerland: "ch",
  usa: "us",
  "united states": "us",
};

function normalizeCountryCode(country?: string, countryCode?: string): string | undefined {
  if (countryCode?.trim()) {
    return countryCode.trim().toLowerCase();
  }

  const byName = country ? COUNTRY_CODE_BY_NAME[country.trim().toLowerCase()] : undefined;
  return byName;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function toCommonsFilePathUrl(fileName: string, width = 900): string {
  const normalized = fileName.replace(/^File:/i, "").trim();
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(normalized)}?width=${width}`;
}

function extractCommonsFileName(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (/^file:/i.test(trimmed)) {
    return trimmed.replace(/^File:/i, "").trim() || null;
  }

  if (!isHttpUrl(trimmed)) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (!parsed.hostname.endsWith("wikimedia.org")) {
      return null;
    }

    const specialFilePathMatch = parsed.pathname.match(/\/wiki\/Special:FilePath\/(.+)$/i);
    if (specialFilePathMatch?.[1]) {
      return decodeURIComponent(specialFilePathMatch[1]).trim() || null;
    }

    const wikiFileMatch = parsed.pathname.match(/\/wiki\/File:(.+)$/i);
    if (wikiFileMatch?.[1]) {
      return decodeURIComponent(wikiFileMatch[1]).trim() || null;
    }

    const queryTitle = parsed.searchParams.get("title");
    if (queryTitle && /^File:/i.test(queryTitle)) {
      return queryTitle.replace(/^File:/i, "").trim() || null;
    }

    return null;
  } catch {
    return null;
  }
}

function isLikelyImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.hostname.endsWith("wikimedia.org")) {
      return true;
    }

    return /\.(avif|jpe?g|png|webp|gif)(\?.*)?$/i.test(url.pathname + url.search);
  } catch {
    return false;
  }
}

function imageFromTags(tags: Record<string, string>): string | null {
  const directImage = tags.image?.trim();
  if (directImage) {
    const commonsFromImageTag = extractCommonsFileName(directImage);
    if (commonsFromImageTag) {
      return toCommonsFilePathUrl(commonsFromImageTag);
    }

    if (isHttpUrl(directImage) && isLikelyImageUrl(directImage)) {
      return directImage;
    }
  }

  const commonsFile = tags.wikimedia_commons?.trim();
  if (commonsFile) {
    const parsedCommonsFile = extractCommonsFileName(commonsFile);
    if (parsedCommonsFile) {
      return toCommonsFilePathUrl(parsedCommonsFile);
    }
  }

  return null;
}

function parseWikipediaTag(value: string): { language: string; title: string } | null {
  const trimmed = value.trim();
  const separator = trimmed.indexOf(":");
  if (separator <= 0) {
    return null;
  }

  const language = trimmed.slice(0, separator).trim().toLowerCase();
  const title = trimmed.slice(separator + 1).trim();
  if (!language || !title) {
    return null;
  }

  return { language, title };
}

const wikidataImageCache = new Map<string, string | null>();

async function getImageFromWikidataId(wikidataId: string): Promise<string | null> {
  const normalized = wikidataId.trim().toUpperCase();
  if (!normalized) {
    return null;
  }

  if (wikidataImageCache.has(normalized)) {
    return wikidataImageCache.get(normalized) ?? null;
  }

  try {
    const endpoint = new URL("https://www.wikidata.org/w/api.php");
    endpoint.searchParams.set("action", "wbgetentities");
    endpoint.searchParams.set("ids", normalized);
    endpoint.searchParams.set("props", "claims");
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("origin", "*");

    const response = await fetch(endpoint.toString());
    if (!response.ok) {
      wikidataImageCache.set(normalized, null);
      return null;
    }

    const payload = (await response.json()) as {
      entities?: Record<
        string,
        {
          claims?: Record<
            string,
            Array<{
              mainsnak?: {
                datavalue?: {
                  value?: unknown;
                };
              };
            }>
          >;
        }
      >;
    };
    const claim = payload.entities?.[normalized]?.claims?.P18?.[0];
    const fileName = typeof claim?.mainsnak?.datavalue?.value === "string" ? claim.mainsnak.datavalue.value : null;
    const imageUrl = fileName ? toCommonsFilePathUrl(fileName) : null;
    wikidataImageCache.set(normalized, imageUrl);
    return imageUrl;
  } catch {
    wikidataImageCache.set(normalized, null);
    return null;
  }
}

async function getWikidataIdFromWikipediaTag(tagValue: string): Promise<string | null> {
  const parsed = parseWikipediaTag(tagValue);
  if (!parsed) {
    return null;
  }

  try {
    const endpoint = new URL(`https://${parsed.language}.wikipedia.org/w/api.php`);
    endpoint.searchParams.set("action", "query");
    endpoint.searchParams.set("prop", "pageprops");
    endpoint.searchParams.set("titles", parsed.title);
    endpoint.searchParams.set("format", "json");
    endpoint.searchParams.set("origin", "*");

    const response = await fetch(endpoint.toString());
    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      query?: { pages?: Record<string, { pageprops?: { wikibase_item?: string } }> };
    };
    const pages = payload.query?.pages ?? {};
    const firstPage = Object.values(pages)[0];
    return firstPage?.pageprops?.wikibase_item ?? null;
  } catch {
    return null;
  }
}

export async function resolveWikimediaImage(tags: Record<string, string>): Promise<string | null> {
  const immediate = imageFromTags(tags);
  if (immediate) {
    return immediate;
  }

  const wikidataTag = tags.wikidata?.trim();
  if (wikidataTag) {
    const fromWikidata = await getImageFromWikidataId(wikidataTag);
    if (fromWikidata) {
      return fromWikidata;
    }
  }

  const wikipediaTag = tags.wikipedia?.trim();
  if (wikipediaTag) {
    const wikidataId = await getWikidataIdFromWikipediaTag(wikipediaTag);
    if (wikidataId) {
      return getImageFromWikidataId(wikidataId);
    }
  }

  return null;
}

function toAddress(tags: Record<string, string>): string {
  const street = tags["addr:street"] ?? "";
  const houseNumber = tags["addr:housenumber"] ?? "";
  const district = tags["addr:suburb"] ?? tags["addr:district"] ?? "";

  const line1 = [street, houseNumber].filter(Boolean).join(" ").trim();
  if (line1 && district) {
    return `${line1}, ${district}`;
  }

  return line1 || district || "Address not listed";
}

function toCategory(tags: Record<string, string>): string {
  const amenity = (tags.amenity ?? "bar").toLowerCase();
  if (amenity === "pub") return "pub";
  if (amenity === "bar") return "bar";
  if (amenity === "nightclub") return "club";
  if (amenity === "biergarten") return "beer garden";
  if (amenity === "restaurant") return "restaurant";
  if (amenity === "fast_food") return "fast food";
  if (amenity === "cafe") return "cafe";
  return "place";
}

function cleanText(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toWebsite(tags: Record<string, string>): string | null {
  const raw = cleanText(tags.website ?? tags["contact:website"] ?? tags.url);
  if (!raw) {
    return null;
  }
  if (isHttpUrl(raw)) {
    return raw;
  }
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(raw)) {
    return `https://${raw}`;
  }
  return null;
}

function toVenueType(tags: Record<string, string>): VenueType {
  const amenity = (tags.amenity ?? "").toLowerCase();
  if (["restaurant", "fast_food"].includes(amenity)) {
    return "restaurant";
  }
  if (amenity === "cafe") {
    return "cafe";
  }
  return "bar";
}

function toVenueTypeFromAmenity(amenityType: string): VenueType {
  if (["restaurant", "fast_food"].includes(amenityType)) {
    return "restaurant";
  }
  if (amenityType === "cafe") {
    return "cafe";
  }
  return "bar";
}

function normalizeBounds(bounds: { north: number; south: number; east: number; west: number }) {
  return {
    north: Math.max(bounds.north, bounds.south),
    south: Math.min(bounds.north, bounds.south),
    east: Math.max(bounds.east, bounds.west),
    west: Math.min(bounds.east, bounds.west),
  };
}

function buildViewBox(center: { lat: number; lng: number }, radiusKm: number): string {
  // Approximate conversion to degrees around a point.
  const latDelta = radiusKm / 110.574;
  const lngDelta = radiusKm / (111.32 * Math.cos((center.lat * Math.PI) / 180) || 1);
  const west = center.lng - lngDelta;
  const east = center.lng + lngDelta;
  const north = center.lat + latDelta;
  const south = center.lat - latDelta;
  return `${west},${north},${east},${south}`;
}

function nominatimAddressToCity(entry: NominatimEntry, fallbackCity: string): string {
  return (
    entry.address?.city
    ?? entry.address?.town
    ?? entry.address?.village
    ?? entry.address?.municipality
    ?? fallbackCity
  );
}

function nominatimAddressToCountry(entry: NominatimEntry, fallbackCountry: string): string {
  return entry.address?.country ?? fallbackCountry;
}

function nominatimAddressToStreet(entry: NominatimEntry): string {
  const road = entry.address?.road ?? "";
  const houseNumber = entry.address?.house_number ?? "";
  const suburb = entry.address?.suburb ?? "";
  const line1 = [road, houseNumber].filter(Boolean).join(" ").trim();
  if (line1 && suburb) {
    return `${line1}, ${suburb}`;
  }
  return line1 || suburb;
}

function toNominatimResult(entry: NominatimEntry, fallbackCity: string, fallbackCountry: string): OsmPlaceResult | null {
  const lat = Number(entry.lat);
  const lng = Number(entry.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }

  const amenityType = (entry.type ?? "").toLowerCase();
  if (!AMENITY_TYPES.has(amenityType)) {
    return null;
  }

  const name = entry.display_name?.split(",")[0]?.trim() || "";
  if (!name) {
    return null;
  }

  const osmType = entry.osm_type;
  const osmId = entry.osm_id;
  if (!osmType || typeof osmId !== "number") {
    return null;
  }

  const address = nominatimAddressToStreet(entry) || "Address not listed";
  const city = nominatimAddressToCity(entry, fallbackCity);
  const country = nominatimAddressToCountry(entry, fallbackCountry);
  const wikiImage = entry.extratags?.wikimedia_commons ? toCommonsFilePathUrl(entry.extratags.wikimedia_commons) : null;

  return {
    sourceProvider: "osm",
    sourcePlaceId: `${osmType}:${osmId}`,
    osmType,
    name,
    category: toCategory({ amenity: amenityType }),
    venueType: toVenueTypeFromAmenity(amenityType),
    address,
    city,
    country,
    lat,
    lng,
    imageUrl: wikiImage,
    openingHours: cleanText(entry.extratags?.opening_hours),
    phone: cleanText(entry.extratags?.phone ?? entry.extratags?.["contact:phone"]),
    email: cleanText(entry.extratags?.email ?? entry.extratags?.["contact:email"]),
    website: cleanText(entry.extratags?.website ?? entry.extratags?.url ?? entry.extratags?.["contact:website"]),
    tags: {},
  };
}

function toResult(element: OverpassElement, fallbackCity: string, fallbackCountry: string): OsmPlaceResult | null {
  const tags = element.tags ?? {};
  const lat = typeof element.lat === "number" ? element.lat : element.center?.lat;
  const lng = typeof element.lon === "number" ? element.lon : element.center?.lon;

  if (typeof lat !== "number" || typeof lng !== "number") {
    return null;
  }

  const name = (tags.name ?? "").trim();
  if (!name) {
    return null;
  }

  return {
    sourceProvider: "osm",
    sourcePlaceId: `${element.type}:${element.id}`,
    osmType: element.type,
    name,
    category: toCategory(tags),
    venueType: toVenueType(tags),
    address: toAddress(tags),
    city: tags["addr:city"] ?? fallbackCity,
    country: tags["addr:country"] ?? fallbackCountry,
    lat,
    lng,
    imageUrl: imageFromTags(tags),
    openingHours: cleanText(tags.opening_hours),
    phone: cleanText(tags["contact:phone"] ?? tags.phone),
    email: cleanText(tags["contact:email"] ?? tags.email),
    website: toWebsite(tags),
    tags,
  };
}

function buildOverpassQuery(input: OsmSearchInput): string {
  const radiusKm = Number.isFinite(input.radiusKm) ? Math.max(0.5, Math.min(input.radiusKm, 25)) : 25;
  const radiusMeters = Math.round(radiusKm * 1000);
  const overpassTimeoutSec = Math.max(4, Math.min(25, input.overpassTimeoutSec ?? 10));
  const escapedQuery = input.query?.trim() ? escapeRegex(input.query.trim()) : "";
  const nameFilter = escapedQuery ? `["name"~"${escapedQuery}", i]` : "";
  const normalizedBounds = input.bounds ? normalizeBounds(input.bounds) : null;

  if (normalizedBounds) {
    return `[out:json][timeout:${overpassTimeoutSec}];\n(\n  nwr(${normalizedBounds.south},${normalizedBounds.west},${normalizedBounds.north},${normalizedBounds.east})["amenity"~"^(pub|bar|biergarten|nightclub|restaurant|fast_food|cafe)$"]${nameFilter};\n);\nout center;`;
  }

  return `[out:json][timeout:${overpassTimeoutSec}];\n(\n  nwr(around:${radiusMeters},${input.center.lat},${input.center.lng})["amenity"~"^(pub|bar|biergarten|nightclub|restaurant|fast_food|cafe)$"]${nameFilter};\n);\nout center;`;
}

export async function searchOsmPlaces(input: OsmSearchInput): Promise<OsmPlaceResult[]> {
  const normalizedBounds = input.bounds ? normalizeBounds(input.bounds) : null;
  const cacheKey = JSON.stringify({
    lat: Number(input.center.lat.toFixed(4)),
    lng: Number(input.center.lng.toFixed(4)),
    radiusKm: Number(input.radiusKm.toFixed(1)),
    bounds: normalizedBounds
      ? {
          north: Number(normalizedBounds.north.toFixed(5)),
          south: Number(normalizedBounds.south.toFixed(5)),
          east: Number(normalizedBounds.east.toFixed(5)),
          west: Number(normalizedBounds.west.toFixed(5)),
        }
      : null,
    query: input.query?.trim().toLowerCase() ?? "",
    city: input.city ?? "",
    country: input.country ?? "",
  });
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const query = buildOverpassQuery(input);

  const response = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: input.signal,
  });

  if (!response.ok) {
    throw new Error(`OSM search failed (${response.status}).`);
  }

  const payload = (await response.json()) as { elements?: OverpassElement[] };
  const elements = payload.elements ?? [];
  const fallbackCity = input.city ?? "Budapest";
  const fallbackCountry = input.country ?? "Hungary";
  const radiusLimit = Number.isFinite(input.radiusKm) ? input.radiusKm : 25;

  const candidates = elements
    .map((element) => toResult(element, fallbackCity, fallbackCountry))
    .filter((result): result is OsmPlaceResult => Boolean(result))
    .filter((result) => {
      if (normalizedBounds) {
        return (
          result.lat <= normalizedBounds.north
          && result.lat >= normalizedBounds.south
          && result.lng <= normalizedBounds.east
          && result.lng >= normalizedBounds.west
        );
      }

      return haversineKm(input.center.lat, input.center.lng, result.lat, result.lng) <= radiusLimit;
    });

  const unique = new Map<string, OsmPlaceResult>();
  for (const candidate of candidates) {
    if (!unique.has(candidate.sourcePlaceId)) {
      unique.set(candidate.sourcePlaceId, candidate);
    }
  }

  const data = Array.from(unique.values())
    .sort((a, b) => {
      const da = haversineKm(input.center.lat, input.center.lng, a.lat, a.lng);
      const db = haversineKm(input.center.lat, input.center.lng, b.lat, b.lng);
      return da - db;
    })
    .slice(0, 260);

  const unresolvedImagePlaces = data.filter((place) => !place.imageUrl && (place.tags.wikidata || place.tags.wikipedia)).slice(0, 24);
  await Promise.all(
    unresolvedImagePlaces.map(async (place) => {
      place.imageUrl = await resolveWikimediaImage(place.tags);
    }),
  );

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data });
  return data;
}

async function searchNominatimPlaces(options: {
  query: string;
  center?: { lat: number; lng: number };
  radiusKm?: number;
  bounded?: boolean;
  countryCode?: string;
  city?: string;
  country?: string;
  limit?: number;
  signal?: AbortSignal;
}): Promise<OsmPlaceResult[]> {
  const query = options.query.trim();
  if (!query) {
    return [];
  }

  const cacheKey = JSON.stringify({
    provider: "nominatim",
    query: query.toLowerCase(),
    countryCode: options.countryCode ?? "",
    bounded: Boolean(options.bounded),
    center: options.center
      ? { lat: Number(options.center.lat.toFixed(4)), lng: Number(options.center.lng.toFixed(4)) }
      : null,
    radiusKm: options.radiusKm ? Number(options.radiusKm.toFixed(1)) : null,
    limit: options.limit ?? 30,
  });

  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const url = new URL(NOMINATIM_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("extratags", "1");
  url.searchParams.set("limit", String(Math.min(40, Math.max(1, options.limit ?? 30))));
  url.searchParams.set("dedupe", "1");

  if (options.countryCode) {
    url.searchParams.set("countrycodes", options.countryCode);
  }

  if (options.center && options.radiusKm && Number.isFinite(options.radiusKm) && options.radiusKm > 0) {
    url.searchParams.set("viewbox", buildViewBox(options.center, options.radiusKm));
    if (options.bounded) {
      url.searchParams.set("bounded", "1");
    }
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Nominatim search failed (${response.status}).`);
  }

  const payload = (await response.json()) as NominatimEntry[];
  const fallbackCity = options.city ?? "Unknown city";
  const fallbackCountry = options.country ?? "Unknown country";
  const mapped = payload
    .map((entry) => toNominatimResult(entry, fallbackCity, fallbackCountry))
    .filter((entry): entry is OsmPlaceResult => Boolean(entry));

  const unique = new Map<string, OsmPlaceResult>();
  for (const entry of mapped) {
    if (!unique.has(entry.sourcePlaceId)) {
      unique.set(entry.sourcePlaceId, entry);
    }
  }

  const results = Array.from(unique.values()).sort((a, b) => {
    if (!options.center) {
      return 0;
    }
    const da = haversineKm(options.center.lat, options.center.lng, a.lat, a.lng);
    const db = haversineKm(options.center.lat, options.center.lng, b.lat, b.lng);
    return da - db;
  });

  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: results });
  return results;
}

export async function searchOsmPlacesProgressive(input: OsmSearchInput): Promise<OsmProgressiveSearchResult> {
  const query = input.query?.trim();
  if (!query) {
    const localResults = await searchOsmPlaces(input);
    return { results: localResults, scope: "radius" };
  }

  // Step 1: Strict local search in current radius (fast + nearby-first UX).
  let local: OsmPlaceResult[] = [];
  try {
    local = await searchOsmPlaces({
      ...input,
      query,
      overpassTimeoutSec: 7,
    });
  } catch {
    local = [];
  }

  if (local.length > 0) {
    return { results: local, scope: "radius" };
  }

  const countryCode = normalizeCountryCode(input.country, input.countryCode);

  // Step 2: Country-wide search.
  if (countryCode) {
    const countryMatches = await searchNominatimPlaces({
      query,
      center: input.center,
      countryCode,
      city: input.city,
      country: input.country,
      limit: 30,
      signal: input.signal,
    });

    if (countryMatches.length > 0) {
      return { results: countryMatches, scope: "country" };
    }
  }

  // Step 3: Global fallback (lets users search/rate places in other countries).
  const globalMatches = await searchNominatimPlaces({
    query,
    center: input.center,
    city: input.city,
    country: input.country,
    limit: 35,
    signal: input.signal,
  });

  return { results: globalMatches, scope: "global" };
}

export function toExternalPub(place: OsmPlaceResult): Pub {
  return {
    id: `osm:${place.sourcePlaceId}`,
    sourceProvider: place.sourceProvider,
    sourcePlaceId: place.sourcePlaceId,
    isExternalCandidate: true,
    slug: undefined,
    category: place.category,
    venueType: place.venueType,
    priceRange: null,
    address: place.address,
    country: place.country,
    openingHours: place.openingHours,
    phone: place.phone,
    email: place.email,
    website: place.website,
    name: place.name,
    area: place.address,
    city: place.city,
    summary: "No ratings yet. Be the first to add a rating.",
    chips: [],
    match: 60,
    ratings: 0,
    vibe: {
      modern: 50,
      lively: 50,
      premium: 50,
      touristy: 50,
      spacious: 50,
    },
    image: place.imageUrl ?? "",
    lat: place.lat,
    lng: place.lng,
  };
}
