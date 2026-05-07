import { Pub, SLIDERS, SliderKey, VibeProfile } from "./vibe";
import type { VenueType } from "../context/FilterContext";

export interface ExploreFilterInput {
  query?: string;
  values: VibeProfile;
  enabled: Record<SliderKey, boolean>;
  margin: number;
  marginEnabled: boolean;
  selectedCity: string;
  selectedArea: string;
  searchRadius: number;
  searchRadiusKmOverride?: number;
  venueTypes?: VenueType[];
  price?: 1 | 2 | 3 | 4 | null;
  showTouristHeavyBars?: boolean;
  center?: { lat: number; lng: number };
}

export const TOURIST_HEAVY_THRESHOLD = 85;

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

export const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  Budapest: { lat: 47.4979, lng: 19.0402 },
  Vienna: { lat: 48.2082, lng: 16.3738 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Prague: { lat: 50.0755, lng: 14.4378 },
  Lisbon: { lat: 38.7223, lng: -9.1393 },
};

export function radiusValueToKm(value: number): number {
  if (value >= 100) {
    return Number.POSITIVE_INFINITY;
  }

  return 0.5 + (value / 100) * 24.5;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function getCityCenter(city: string): { lat: number; lng: number } {
  return CITY_CENTERS[city] ?? CITY_CENTERS.Budapest;
}

function matchesSearch(pub: Pub, query: string): boolean {
  if (!query.trim()) {
    return true;
  }

  const q = normalizeText(query);
  const name = normalizeText(pub.name);
  const city = normalizeText(pub.city);
  const area = normalizeText(pub.area);
  const summary = normalizeText(pub.summary);
  const address = normalizeText(pub.address ?? "");
  const category = normalizeText(pub.category ?? "");

  return (
    name.includes(q) ||
    city.includes(q) ||
    area.includes(q) ||
    summary.includes(q) ||
    address.includes(q) ||
    category.includes(q) ||
    pub.chips.some((chip) => normalizeText(chip).includes(q))
  );
}

export function matchesSearchQuery(pub: Pub, query: string): boolean {
  return matchesSearch(pub, query);
}

function searchMatchScore(pub: Pub, query: string): number {
  if (!query.trim()) {
    return 1;
  }

  const q = normalizeText(query);
  const name = normalizeText(pub.name);
  const city = normalizeText(pub.city);
  const area = normalizeText(pub.area);
  const summary = normalizeText(pub.summary);
  const address = normalizeText(pub.address ?? "");
  const category = normalizeText(pub.category ?? "");
  const chipMatch = pub.chips.some((chip) => normalizeText(chip).includes(q));

  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 0.92;
  if (chipMatch) return 0.85;
  if (area.includes(q) || city.includes(q) || address.includes(q)) return 0.78;
  if (category.includes(q)) return 0.75;
  if (summary.includes(q)) return 0.72;

  return 0;
}

function sliderMatchScore(pub: Pub, filters: ExploreFilterInput): number {
  const activeSliderKeys = (Object.keys(filters.enabled) as SliderKey[]).filter((key) => filters.enabled[key]);

  if (activeSliderKeys.length === 0) {
    return 1;
  }

  const rawScore =
    activeSliderKeys.reduce((acc, key) => {
      const diff = Math.abs(pub.vibe[key] - filters.values[key]);
      return acc + (1 - diff / 100);
    }, 0) / activeSliderKeys.length;

  // Slight bonus when tolerance is tight and the pub still matches it.
  if (!filters.marginEnabled) {
    return rawScore;
  }

  const strictness = 1 - Math.min(filters.margin, 100) / 100;
  return Math.min(1, rawScore + strictness * 0.08);
}

export function isPerfectPubMatch(pub: Pub, filters: ExploreFilterInput): boolean {
  if (!pub.ratings || pub.ratings <= 0) {
    return false;
  }

  const activeSliderKeys = (Object.keys(filters.enabled) as SliderKey[]).filter((key) => filters.enabled[key]);
  if (activeSliderKeys.length !== SLIDERS.length) {
    return false;
  }

  return activeSliderKeys.every((key) => Math.round(pub.vibe[key]) === Math.round(filters.values[key]));
}

function radiusMatchScore(pub: Pub, selectedCity: string, radiusValue: number, centerOverride?: { lat: number; lng: number }): number {
  const radiusKm = radiusValueToKm(radiusValue);
  const center = centerOverride ?? getCityCenter(selectedCity);

  if (!Number.isFinite(radiusKm)) {
    return 1;
  }

  const distanceKm = haversineKm(center.lat, center.lng, pub.lat, pub.lng);
  const score = 1 - distanceKm / radiusKm;
  return Math.max(0, Math.min(1, score));
}

export function hasActiveMatchFilters(filters: ExploreFilterInput): boolean {
  const anySliderEnabled = (Object.keys(filters.enabled) as SliderKey[]).some((key) => filters.enabled[key]);
  const hasQuery = Boolean(filters.query?.trim());
  const hasArea = filters.selectedArea !== "All areas";
  const hasNonDefaultCity = filters.selectedCity !== "Budapest";
  const hasFiniteRadius = Number.isFinite(radiusValueToKm(filters.searchRadius));
  const hasVenueType = (filters.venueTypes ?? []).length > 0;
  const hasPrice = filters.price != null;
  const touristFilterEnabled = filters.showTouristHeavyBars === false;

  return anySliderEnabled || hasQuery || hasArea || hasNonDefaultCity || hasFiniteRadius || hasVenueType || hasPrice || touristFilterEnabled;
}

export function calculatePubMatchPercent(pub: Pub, filters: ExploreFilterInput): number {
  const activeSliderKeys = (Object.keys(filters.enabled) as SliderKey[]).filter((key) => filters.enabled[key]);

  if (!pub.ratings || pub.ratings <= 0) {
    return 0;
  }

  if (activeSliderKeys.length === 0) {
    return pub.match;
  }

  if (isPerfectPubMatch(pub, filters)) {
    return 100;
  }

  const score = sliderMatchScore(pub, filters);
  return Math.max(1, Math.min(99, Math.round(score * 100)));
}

export function filterPubs(pubs: Pub[], filters: ExploreFilterInput): Pub[] {
  const {
    query = "",
    values,
    enabled,
    margin,
    marginEnabled,
    selectedCity,
    selectedArea,
    searchRadius,
    searchRadiusKmOverride,
    venueTypes = [],
    price = null,
    showTouristHeavyBars = true,
    center: centerOverride,
  } = filters;

  const effectiveMargin = marginEnabled ? margin : 100;
  const center = centerOverride ?? getCityCenter(selectedCity);
  const radiusKm = searchRadiusKmOverride ?? radiusValueToKm(searchRadius);
  const selectedCityCenter = getCityCenter(selectedCity);
  const shouldEnforceSelectedCity =
    !centerOverride || haversineKm(centerOverride.lat, centerOverride.lng, selectedCityCenter.lat, selectedCityCenter.lng) <= 1.2;

  return pubs.filter((pub) => {
    if (shouldEnforceSelectedCity && selectedCity && !pub.isExternalCandidate && pub.city !== selectedCity) {
      return false;
    }

    if (!pub.isExternalCandidate && selectedArea !== "All areas" && pub.area !== selectedArea) {
      return false;
    }

    if (!matchesSearch(pub, query)) {
      return false;
    }

    if (venueTypes.length > 0) {
      const pubVenueType = pub.venueType ?? "bar";
      if (!venueTypes.includes(pubVenueType)) {
        return false;
      }
    }

    if (price != null && pub.priceRange !== price) {
      return false;
    }

    if (!showTouristHeavyBars && pub.vibe.touristy >= TOURIST_HEAVY_THRESHOLD) {
      return false;
    }

    if (!Number.isFinite(radiusKm)) {
      // no radius limit
    } else {
      const distance = haversineKm(center.lat, center.lng, pub.lat, pub.lng);
      if (distance > radiusKm) {
        return false;
      }
    }

    for (const key of Object.keys(enabled) as SliderKey[]) {
      if (!enabled[key]) {
        continue;
      }

      if (Math.abs(pub.vibe[key] - values[key]) > effectiveMargin) {
        return false;
      }
    }

    return true;
  });
}

export function getAreasForCity(pubs: Pub[], city: string): string[] {
  const areas = new Set<string>();

  for (const pub of pubs) {
    if (pub.city === city) {
      areas.add(pub.area);
    }
  }

  return ["All areas", ...Array.from(areas)];
}
