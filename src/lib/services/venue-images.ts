import type { Pub } from "@/app/components/vibe";
import { resolveWikimediaImage } from "@/lib/services/osm";

const COMMONS_API_ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const NOMINATIM_LOOKUP_ENDPOINT = "https://nominatim.openstreetmap.org/lookup";
const IMAGE_CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const OSM_METADATA_CACHE_TTL_MS = 1000 * 60 * 60 * 24;
const MAX_CONCURRENT_RESOLVES = 2;
const MIN_CONFIDENCE_SCORE = 0.46;
const STOP_WORDS = new Set([
  "the",
  "and",
  "of",
  "in",
  "at",
  "bar",
  "pub",
  "cafe",
  "restaurant",
  "budapest",
]);

type ImageCacheEntry = {
  expiresAt: number;
  imageUrl: string | null;
};

type OsmMetadataCacheEntry = {
  expiresAt: number;
  tags: Record<string, string> | null;
};

type VenueImageInput = Pick<
  Pub,
  "id" | "name" | "lat" | "lng" | "city" | "country" | "sourceProvider" | "sourcePlaceId" | "address" | "category" | "venueType"
>;

const imageCache = new Map<string, ImageCacheEntry>();
const osmMetadataCache = new Map<string, OsmMetadataCacheEntry>();
const inFlight = new Map<string, Promise<string | null>>();
let activeResolves = 0;
const waitingResolvers: Array<() => void> = [];

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isHttpUrl(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toTokenSet(value: string): Set<string> {
  const normalized = normalizeText(value);
  if (!normalized) {
    return new Set<string>();
  }

  return new Set(
    normalized
      .split(" ")
      .map((part) => part.trim())
      .filter((part) => part.length >= 2 && !STOP_WORDS.has(part)),
  );
}

function overlapRatio(needles: Set<string>, haystack: Set<string>): number {
  if (needles.size === 0 || haystack.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of needles) {
    if (haystack.has(token)) {
      overlap += 1;
    }
  }

  return overlap / needles.size;
}

function makeCacheKey(input: VenueImageInput): string {
  if (input.sourceProvider && input.sourcePlaceId) {
    return `${input.sourceProvider}:${input.sourcePlaceId}`;
  }
  return `${normalizeText(input.name)}|${input.city.toLowerCase()}|${input.country?.toLowerCase() ?? ""}|${input.lat.toFixed(4)}|${input.lng.toFixed(4)}`;
}

async function withResolveSlot<T>(task: () => Promise<T>): Promise<T> {
  if (activeResolves >= MAX_CONCURRENT_RESOLVES) {
    await new Promise<void>((resolve) => {
      waitingResolvers.push(resolve);
    });
  }

  activeResolves += 1;
  try {
    return await task();
  } finally {
    activeResolves = Math.max(0, activeResolves - 1);
    const next = waitingResolvers.shift();
    if (next) {
      next();
    }
  }
}

type CommonsGeosearchEntry = {
  title: string;
  dist?: number;
};

type OsmLookupEntry = {
  extratags?: Record<string, string>;
  wikipedia?: string;
  wikidata?: string;
  image?: string;
  wikimedia_commons?: string;
};

type CommonsImageInfoPage = {
  title: string;
  imageinfo?: Array<{
    url?: string;
    thumburl?: string;
  }>;
};

async function fetchCommonsImageFromTitles(titles: string[]): Promise<Array<{ title: string; url: string }>> {
  if (titles.length === 0) {
    return [];
  }

  const infoUrl = new URL(COMMONS_API_ENDPOINT);
  infoUrl.searchParams.set("action", "query");
  infoUrl.searchParams.set("format", "json");
  infoUrl.searchParams.set("origin", "*");
  infoUrl.searchParams.set("prop", "imageinfo");
  infoUrl.searchParams.set("iiprop", "url");
  infoUrl.searchParams.set("iiurlwidth", "900");
  infoUrl.searchParams.set("titles", titles.join("|"));

  const response = await fetch(infoUrl.toString());
  if (!response.ok) {
    return [];
  }

  const payload = (await response.json()) as { query?: { pages?: Record<string, CommonsImageInfoPage> } };
  const pages = payload.query?.pages ?? {};
  return Object.values(pages)
    .map((page) => {
      const info = page.imageinfo?.[0];
      const url = info?.thumburl ?? info?.url;
      if (!url || !isHttpUrl(url)) {
        return null;
      }
      return { title: page.title, url };
    })
    .filter((entry): entry is { title: string; url: string } => Boolean(entry));
}

function parseOsmLookupId(sourcePlaceId: string): string | null {
  const matched = sourcePlaceId.trim().match(/^(node|way|relation):(\d+)$/i);
  if (!matched) {
    return null;
  }

  const type = matched[1].toLowerCase();
  const id = matched[2];

  if (type === "node") return `N${id}`;
  if (type === "way") return `W${id}`;
  if (type === "relation") return `R${id}`;
  return null;
}

async function fetchOsmTagsForSource(input: VenueImageInput): Promise<Record<string, string> | null> {
  if (input.sourceProvider !== "osm" || !input.sourcePlaceId) {
    return null;
  }

  const cacheKey = `${input.sourceProvider}:${input.sourcePlaceId}`;
  const cached = osmMetadataCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.tags;
  }

  const lookupId = parseOsmLookupId(input.sourcePlaceId);
  if (!lookupId) {
    osmMetadataCache.set(cacheKey, { tags: null, expiresAt: Date.now() + OSM_METADATA_CACHE_TTL_MS });
    return null;
  }

  try {
    const lookupUrl = new URL(NOMINATIM_LOOKUP_ENDPOINT);
    lookupUrl.searchParams.set("osm_ids", lookupId);
    lookupUrl.searchParams.set("format", "jsonv2");
    lookupUrl.searchParams.set("addressdetails", "0");
    lookupUrl.searchParams.set("extratags", "1");

    const response = await fetch(lookupUrl.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      osmMetadataCache.set(cacheKey, { tags: null, expiresAt: Date.now() + OSM_METADATA_CACHE_TTL_MS });
      return null;
    }

    const payload = (await response.json()) as OsmLookupEntry[];
    const first = payload[0];
    if (!first) {
      osmMetadataCache.set(cacheKey, { tags: null, expiresAt: Date.now() + OSM_METADATA_CACHE_TTL_MS });
      return null;
    }

    const tags: Record<string, string> = { ...(first.extratags ?? {}) };
    if (first.wikipedia && !tags.wikipedia) {
      tags.wikipedia = first.wikipedia;
    }
    if (first.wikidata && !tags.wikidata) {
      tags.wikidata = first.wikidata;
    }
    if (first.image && !tags.image) {
      tags.image = first.image;
    }
    if (first.wikimedia_commons && !tags.wikimedia_commons) {
      tags.wikimedia_commons = first.wikimedia_commons;
    }

    const normalizedTags = Object.entries(tags).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value !== "string") {
        return acc;
      }
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        acc[key] = trimmed;
      }
      return acc;
    }, {});

    const result = Object.keys(normalizedTags).length > 0 ? normalizedTags : null;
    osmMetadataCache.set(cacheKey, { tags: result, expiresAt: Date.now() + OSM_METADATA_CACHE_TTL_MS });
    return result;
  } catch {
    osmMetadataCache.set(cacheKey, { tags: null, expiresAt: Date.now() + OSM_METADATA_CACHE_TTL_MS });
    return null;
  }
}

function scoreCandidate(input: VenueImageInput, title: string, distMeters?: number): number {
  const normalizedTitle = normalizeText(title.replace(/^file:/i, "").replace(/\.[a-z0-9]{2,5}$/i, ""));
  const titleTokens = toTokenSet(normalizedTitle);

  const nameTokens = toTokenSet(input.name);
  const cityTokens = toTokenSet(input.city);
  const addressTokens = toTokenSet(input.address ?? "");

  const normalizedName = normalizeText(input.name);
  const exactNameMatch = normalizedName && normalizedTitle.includes(normalizedName) ? 1 : 0;

  const nameScore = overlapRatio(nameTokens, titleTokens);
  const cityScore = overlapRatio(cityTokens, titleTokens);
  const addressScore = overlapRatio(addressTokens, titleTokens);
  const distanceScore = typeof distMeters === "number" ? clamp(1 - distMeters / 600, 0, 1) : 0.35;

  return (
    exactNameMatch * 0.42
    + nameScore * 0.38
    + cityScore * 0.08
    + addressScore * 0.07
    + distanceScore * 0.05
  );
}

async function resolveFromOsmMetadata(input: VenueImageInput): Promise<string | null> {
  const tags = await fetchOsmTagsForSource(input);
  if (!tags) {
    return null;
  }

  return resolveWikimediaImage(tags);
}

async function resolveFromCommonsGeosearch(input: VenueImageInput): Promise<string | null> {
  const radii = [180, 360, 700];

  for (const radius of radii) {
    const geoUrl = new URL(COMMONS_API_ENDPOINT);
    geoUrl.searchParams.set("action", "query");
    geoUrl.searchParams.set("format", "json");
    geoUrl.searchParams.set("origin", "*");
    geoUrl.searchParams.set("list", "geosearch");
    geoUrl.searchParams.set("gsprimary", "all");
    geoUrl.searchParams.set("gsnamespace", "6");
    geoUrl.searchParams.set("gslimit", "12");
    geoUrl.searchParams.set("gsradius", String(radius));
    geoUrl.searchParams.set("gscoord", `${input.lat}|${input.lng}`);

    const response = await fetch(geoUrl.toString());
    if (!response.ok) {
      continue;
    }

    const payload = (await response.json()) as { query?: { geosearch?: CommonsGeosearchEntry[] } };
    const hits = payload.query?.geosearch ?? [];
    if (hits.length === 0) {
      continue;
    }

    const titles = hits.map((hit) => hit.title).filter(Boolean);
    const distLookup = new Map<string, number>();
    for (const hit of hits) {
      if (typeof hit.dist === "number") {
        distLookup.set(hit.title, hit.dist);
      }
    }

    const images = await fetchCommonsImageFromTitles(titles);
    if (images.length === 0) {
      continue;
    }

    const scored = images
      .map((image) => ({
        ...image,
        score: scoreCandidate(input, image.title, distLookup.get(image.title)),
      }))
      .sort((a, b) => b.score - a.score);

    const best = scored[0];
    if (best && best.score >= MIN_CONFIDENCE_SCORE) {
      return best.url;
    }
  }

  return null;
}

async function resolveInternal(input: VenueImageInput): Promise<string | null> {
  try {
    const fromOsmMetadata = await resolveFromOsmMetadata(input);
    if (fromOsmMetadata) {
      return fromOsmMetadata;
    }

    return await resolveFromCommonsGeosearch(input);
  } catch {
    return null;
  }
}

export async function resolveVenueImage(input: VenueImageInput): Promise<string | null> {
  const cacheKey = makeCacheKey(input);
  const cached = imageCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.imageUrl;
  }

  const running = inFlight.get(cacheKey);
  if (running) {
    return running;
  }

  const job = withResolveSlot(async () => {
    const imageUrl = await resolveInternal(input);
    imageCache.set(cacheKey, {
      imageUrl,
      expiresAt: Date.now() + IMAGE_CACHE_TTL_MS,
    });
    return imageUrl;
  }).finally(() => {
    inFlight.delete(cacheKey);
  });

  inFlight.set(cacheKey, job);
  return job;
}
