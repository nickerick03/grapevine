import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { Search, SlidersHorizontal, User, Plus } from "lucide-react";
import { CircleNotch, Crosshair, Eye, EyeSlash, MagnifyingGlassMinus } from "@phosphor-icons/react";
import { SLIDERS, type Pub } from "../vibe";
import {
  calculatePubMatchPercent,
  filterPubs,
  getCityCenter,
  haversineKm,
  isPerfectPubMatch,
  matchesSearchQuery,
  radiusValueToKm,
} from "../filtering";
import { PubCard } from "../PubCard";
import { MapView } from "../MapView";
import { BottomNav } from "../BottomNav";
import { useAuth } from "../../context/AuthContext";
import { useFilters } from "../../context/FilterContext";
import { usePlaces } from "../../context/PlacesContext";
import { useUI } from "../../context/UIContext";
import { formatDistance, useSettings } from "../../context/SettingsContext";
import { AdUnit } from "../AdUnit";
import { searchOsmPlaces, searchOsmPlacesProgressive, toExternalPub, type OsmPlaceResult } from "@/lib/services/osm";

const CITY_TO_COUNTRY: Record<string, string> = {
  Budapest: "Hungary",
  Vienna: "Austria",
  Berlin: "Germany",
  Prague: "Czechia",
  Lisbon: "Portugal",
};

const EXPLORE_MAP_STATE_KEY = "grapevine.explore.mapState.v1";

type PersistedExploreMapState = {
  center: { lat: number; lng: number };
  bounds: { north: number; south: number; east: number; west: number } | null;
  searchAreaRadiusKm: number | null;
  eyeMode?: boolean;
};

function readPersistedExploreMapState(): PersistedExploreMapState | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(EXPLORE_MAP_STATE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedExploreMapState;
    if (!parsed?.center || !Number.isFinite(parsed.center.lat) || !Number.isFinite(parsed.center.lng)) {
      return null;
    }

    const hasBounds =
      !!parsed.bounds
      && Number.isFinite(parsed.bounds.north)
      && Number.isFinite(parsed.bounds.south)
      && Number.isFinite(parsed.bounds.east)
      && Number.isFinite(parsed.bounds.west);

    return {
      center: parsed.center,
      bounds: hasBounds ? parsed.bounds : null,
      searchAreaRadiusKm: parsed.searchAreaRadiusKm != null && Number.isFinite(parsed.searchAreaRadiusKm)
        ? parsed.searchAreaRadiusKm
        : null,
      eyeMode: typeof parsed.eyeMode === "boolean" ? parsed.eyeMode : false,
    };
  } catch {
    return null;
  }
}

function normalizePlaceText(value: string | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function areLikelySamePlace(a: Pub, b: Pub): boolean {
  if (a.sourceProvider && b.sourceProvider && a.sourcePlaceId && b.sourcePlaceId) {
    if (a.sourceProvider === b.sourceProvider && a.sourcePlaceId === b.sourcePlaceId) {
      return true;
    }
  }

  const distanceKm = haversineKm(a.lat, a.lng, b.lat, b.lng);
  const nameA = normalizePlaceText(a.name);
  const nameB = normalizePlaceText(b.name);
  const addressA = normalizePlaceText(a.address ?? a.area);
  const addressB = normalizePlaceText(b.address ?? b.area);

  const nameClose =
    !!nameA &&
    !!nameB &&
    (nameA === nameB || nameA.includes(nameB) || nameB.includes(nameA));

  const addressClose = !!addressA && !!addressB && (addressA === addressB || addressA.includes(addressB) || addressB.includes(addressA));

  if ((nameClose || addressClose) && distanceKm <= 0.2) {
    return true;
  }

  // Safety net for near-identical map points from different providers.
  return distanceKm <= 0.012;
}

function removeExternalDuplicates(external: Pub[], rated: Pub[]): Pub[] {
  const result: Pub[] = [];

  for (const candidate of external) {
    const duplicatesRated = rated.some((ratedPub) => areLikelySamePlace(candidate, ratedPub));
    if (duplicatesRated) {
      continue;
    }

    const duplicatesExternal = result.some((existing) => areLikelySamePlace(candidate, existing));
    if (duplicatesExternal) {
      continue;
    }

    result.push(candidate);
  }

  return result;
}

function computeRadiusFromBounds(
  bounds: { north: number; south: number; east: number; west: number },
  center: { lat: number; lng: number },
): number {
  const northSouth = haversineKm(bounds.north, center.lng, bounds.south, center.lng);
  const eastWest = haversineKm(center.lat, bounds.west, center.lat, bounds.east);
  const halfDiagonal = Math.sqrt((northSouth / 2) ** 2 + (eastWest / 2) ** 2);
  if (!Number.isFinite(halfDiagonal) || halfDiagonal <= 0) {
    return 6.5;
  }

  return Math.min(25, Math.max(0.8, halfDiagonal * 1.1));
}

export function ExploreScreen() {
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();
  const { pubs, loading: placesLoading } = usePlaces();
  const { values, enabled, margin, marginEnabled, selectedCity, selectedArea, searchRadius, venueTypes, price } = useFilters();
  const { distanceUnit, showTouristHeavyBars } = useSettings();
  const { openRate } = useUI();

  const persistedMapState = readPersistedExploreMapState();
  const [view, setView] = useState<"map" | "list">("map");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const [located, setLocated] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | undefined>();
  const [searchCenter, setSearchCenter] = useState<{ lat: number; lng: number }>(() => {
    return persistedMapState?.center ?? getCityCenter(selectedCity);
  });
  const [searchAreaRadiusKm, setSearchAreaRadiusKm] = useState<number | null>(() => {
    return persistedMapState?.searchAreaRadiusKm ?? null;
  });
  const [searchAreaMode, setSearchAreaMode] = useState<boolean>(() => {
    return persistedMapState?.searchAreaRadiusKm != null;
  });
  const [lastMapCenter, setLastMapCenter] = useState<{ lat: number; lng: number } | null>(() => {
    return persistedMapState?.center ?? null;
  });
  const [mapBounds, setMapBounds] = useState<{ north: number; south: number; east: number; west: number } | null>(() => {
    return persistedMapState?.bounds ?? null;
  });
  const [manualMapDeselected, setManualMapDeselected] = useState(false);
  const [showUnratedByTypeOnly, setShowUnratedByTypeOnly] = useState<boolean>(() => persistedMapState?.eyeMode ?? false);
  const [externalPubs, setExternalPubs] = useState<Pub[]>([]);
  const [queryBoostPubs, setQueryBoostPubs] = useState<Pub[]>([]);
  const [externalLookup, setExternalLookup] = useState<Map<string, OsmPlaceResult>>(new Map());
  const [externalLoading, setExternalLoading] = useState(false);
  const [externalPoolStale, setExternalPoolStale] = useState(false);
  const [queryBoostLoading, setQueryBoostLoading] = useState(false);
  const [querySearchScope, setQuerySearchScope] = useState<"radius" | "country" | "global">("radius");
  const [displayMapCount, setDisplayMapCount] = useState(0);
  const displayMapCountRef = useRef(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const startY = useRef(0);
  const currentY = useRef(0);
  const skipSelectedCitySyncOnMount = useRef(true);
  const hasSliderFilters = useMemo(() => SLIDERS.some((slider) => enabled[slider.key]), [enabled]);
  const hasPriceFilter = price != null;
  const areaDiscoveryMode = showUnratedByTypeOnly || searchAreaMode;
  const forceAllVenuesInArea = areaDiscoveryMode;
  const effectiveHasSliderFilters = hasSliderFilters && !forceAllVenuesInArea;
  const includeUnratedVenues = forceAllVenuesInArea || (!hasSliderFilters && !hasPriceFilter);
  const effectiveQuery = areaDiscoveryMode ? "" : query;
  const effectiveDebouncedQuery = areaDiscoveryMode ? "" : debouncedQuery;
  const hasSearchQuery = effectiveQuery.trim().length > 0;
  const radiusKm = radiusValueToKm(searchRadius);
  const effectiveRadiusKm = searchAreaRadiusKm ?? radiusKm;
  const selectedCountry = CITY_TO_COUNTRY[selectedCity] ?? "Hungary";

  const mapBoundsRadiusKm = useMemo(() => {
    if (!mapBounds || !lastMapCenter) {
      return null;
    }
    return computeRadiusFromBounds(mapBounds, lastMapCenter);
  }, [lastMapCenter, mapBounds]);

  const activeSearchCenter = areaDiscoveryMode ? (lastMapCenter ?? searchCenter) : searchCenter;
  const activeSearchRadiusKm = areaDiscoveryMode ? (mapBoundsRadiusKm ?? searchAreaRadiusKm ?? 6.5) : effectiveRadiusKm;
  const activeSearchBounds = areaDiscoveryMode ? mapBounds : null;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);
    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const centerToPersist = lastMapCenter ?? searchCenter;
    const payload: PersistedExploreMapState = {
      center: centerToPersist,
      bounds: mapBounds,
      searchAreaRadiusKm: searchAreaMode ? searchAreaRadiusKm : null,
      eyeMode: showUnratedByTypeOnly,
    };
    window.sessionStorage.setItem(EXPLORE_MAP_STATE_KEY, JSON.stringify(payload));
  }, [lastMapCenter, mapBounds, searchAreaMode, searchAreaRadiusKm, searchCenter, showUnratedByTypeOnly]);

  useEffect(() => {
    if (skipSelectedCitySyncOnMount.current) {
      skipSelectedCitySyncOnMount.current = false;
      return;
    }

    setSearchCenter(getCityCenter(selectedCity));
    setSearchAreaRadiusKm(null);
    setSearchAreaMode(false);
    setLastMapCenter(null);
    setMapBounds(null);
  }, [selectedCity]);

  useEffect(() => {
    setManualMapDeselected(false);
  }, [enabled, margin, marginEnabled, query, searchRadius, selectedArea, selectedCity, values]);

  useEffect(() => {
    if (effectiveDebouncedQuery.length >= 3) {
      setExternalLoading(false);
      return;
    }

    if (areaDiscoveryMode) {
      return;
    }

    if (!includeUnratedVenues && effectiveHasSliderFilters && effectiveDebouncedQuery.length < 3) {
      setExternalPubs([]);
      setQueryBoostPubs([]);
      setExternalLookup(new Map());
      setExternalLoading(false);
      setExternalPoolStale(false);
      setQueryBoostLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const lookupRadiusKm = effectiveDebouncedQuery.length >= 3
      ? 120
      : (Number.isFinite(activeSearchRadiusKm) ? activeSearchRadiusKm : 25);
    setQueryBoostPubs([]);

    setExternalLoading(true);
    searchOsmPlaces({
      center: activeSearchCenter,
      radiusKm: lookupRadiusKm,
      city: selectedCity,
      country: selectedCountry,
      signal: controller.signal,
    })
      .then((results) => {
        if (cancelled) {
          return;
        }

        const nextLookup = new Map<string, OsmPlaceResult>(results.map((result) => [result.sourcePlaceId, result]));
        const mapped = results.map(toExternalPub);
        const deduped = removeExternalDuplicates(mapped, pubs);

        setExternalLookup(nextLookup);
        setExternalPubs(deduped);
        setExternalPoolStale(false);
      })
      .catch(() => {
        if (!cancelled && !controller.signal.aborted) {
          // Keep previous external results on transient OSM errors/rate limits.
          setExternalPoolStale(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setExternalLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeSearchCenter, activeSearchRadiusKm, areaDiscoveryMode, effectiveDebouncedQuery.length, effectiveHasSliderFilters, includeUnratedVenues, pubs, selectedCity, selectedCountry]);

  useEffect(() => {
    if (!areaDiscoveryMode) {
      setExternalPoolStale(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const areaRadiusKm = Number.isFinite(activeSearchRadiusKm) ? Math.min(Math.max(activeSearchRadiusKm, 0.8), 25) : 6.5;

    setExternalLoading(true);
    searchOsmPlaces({
      center: activeSearchCenter,
      radiusKm: areaRadiusKm,
      bounds: activeSearchBounds ?? undefined,
      city: selectedCity,
      country: selectedCountry,
      signal: controller.signal,
    })
      .then((results) => {
        if (cancelled) {
          return;
        }
        const nextLookup = new Map<string, OsmPlaceResult>(results.map((result) => [result.sourcePlaceId, result]));
        const mapped = results.map(toExternalPub);
        const deduped = removeExternalDuplicates(mapped, pubs);
        setExternalLookup((prev) => new Map([...prev, ...nextLookup]));
        setExternalPubs(deduped);
        setExternalPoolStale(false);
      })
      .catch(() => {
        if (!cancelled && !controller.signal.aborted) {
          // Keep previous area results when OSM has transient failures.
          setExternalPoolStale(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setExternalLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeSearchBounds, activeSearchCenter, activeSearchRadiusKm, areaDiscoveryMode, pubs, selectedCity, selectedCountry]);

  useEffect(() => {
    if (areaDiscoveryMode) {
      setQueryBoostLoading(false);
      setQuerySearchScope("radius");
      setQueryBoostPubs([]);
      return;
    }

    if (effectiveDebouncedQuery.length < 3) {
      setQueryBoostLoading(false);
      setQuerySearchScope("radius");
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    const boostRadiusKm = Number.isFinite(activeSearchRadiusKm) ? Math.min(Math.max(activeSearchRadiusKm, 1), 25) : 25;
    setQueryBoostLoading(true);

    searchOsmPlacesProgressive({
      center: activeSearchCenter,
      radiusKm: boostRadiusKm,
      query: effectiveDebouncedQuery,
      city: selectedCity,
      country: selectedCountry,
      signal: controller.signal,
    })
      .then(({ results, scope }) => {
        if (cancelled) {
          return;
        }
        setQuerySearchScope(scope);

        const mapped = results.map(toExternalPub);
        const known = new Set([
          ...pubs.map((pub) => pub.id),
          ...externalPubs.map((pub) => pub.id),
        ]);
        const deduped = removeExternalDuplicates(
          mapped.filter((candidate) => !known.has(candidate.id)),
          pubs,
        ).filter((candidate) => !externalPubs.some((existing) => areLikelySamePlace(candidate, existing)));

        setExternalLookup((prev) => {
          const merged = new Map(prev);
          for (const result of results) {
            merged.set(result.sourcePlaceId, result);
          }
          return merged;
        });
        setQueryBoostPubs((prev) => {
          const merged = new Map<string, Pub>();
          for (const item of prev) {
            merged.set(item.id, item);
          }
          for (const item of deduped) {
            merged.set(item.id, item);
          }
          return Array.from(merged.values());
        });
      })
      .catch(() => {
        if (controller.signal.aborted) {
          return;
        }
        // Keep previously collected query-boost places on transient errors.
      })
      .finally(() => {
        if (!cancelled) {
          setQueryBoostLoading(false);
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [activeSearchCenter, activeSearchRadiusKm, areaDiscoveryMode, effectiveDebouncedQuery, externalPubs, pubs, selectedCity, selectedCountry]);

  const filtered = useMemo(() => {
    const activeFilters = {
      query: effectiveQuery,
      values,
      enabled: forceAllVenuesInArea
        ? {
            modern: false,
            lively: false,
            premium: false,
            touristy: false,
            spacious: false,
          }
        : enabled,
      margin,
      marginEnabled: forceAllVenuesInArea ? false : marginEnabled,
      selectedCity,
      selectedArea: forceAllVenuesInArea ? "All areas" : selectedArea,
      searchRadius,
      searchRadiusKmOverride: forceAllVenuesInArea ? Number.POSITIVE_INFINITY : activeSearchRadiusKm,
      venueTypes,
      price: forceAllVenuesInArea ? null : price,
      showTouristHeavyBars,
      center: activeSearchCenter,
    };

    const filteredRatedPubs = filterPubs(pubs, activeFilters).map((pub) => {
      const match = calculatePubMatchPercent(pub, activeFilters);
      const perfectMatch = isPerfectPubMatch(pub, activeFilters);
      return {
        ...pub,
        match,
        perfectMatch,
      };
    });

    const externalBaseFilters = {
      ...activeFilters,
      enabled: {
        modern: false,
        lively: false,
        premium: false,
        touristy: false,
        spacious: false,
      },
      price: null,
      margin: 100,
      marginEnabled: false,
    } as const;

    const allExternalPubs = removeExternalDuplicates([...externalPubs, ...queryBoostPubs], pubs);

    if (hasSearchQuery) {
      const combined = [...pubs, ...allExternalPubs];
      const unique = new Map<string, Pub>();

      for (const pub of combined) {
        if (!matchesSearchQuery(pub, effectiveQuery)) {
          continue;
        }

        const duplicateExisting = Array.from(unique.values()).some((existing) => areLikelySamePlace(existing, pub));
        if (!duplicateExisting) {
          unique.set(pub.id, pub);
        }
      }

      const searched = Array.from(unique.values()).map((pub) => {
        const match = calculatePubMatchPercent(pub, activeFilters);
        const perfectMatch = isPerfectPubMatch(pub, activeFilters);
        return {
          ...pub,
          match,
          perfectMatch,
        };
      });

      if (effectiveHasSliderFilters) {
        searched.sort((a, b) => b.match - a.match);
      }

      return searched;
    }

    const canShowExternal = includeUnratedVenues;
    const filteredExternalPubs = canShowExternal
      ? filterPubs(allExternalPubs, externalBaseFilters).map((pub) => {
          const match = calculatePubMatchPercent(pub, externalBaseFilters);
          const perfectMatch = isPerfectPubMatch(pub, externalBaseFilters);
          return {
            ...pub,
            match,
            perfectMatch,
          };
        })
      : [];

    const filteredPubs = [...filteredRatedPubs, ...filteredExternalPubs];

    if (effectiveHasSliderFilters) {
      filteredPubs.sort((a, b) => b.match - a.match);
    }

    return filteredPubs;
  }, [activeSearchCenter, activeSearchRadiusKm, effectiveHasSliderFilters, effectiveQuery, enabled, externalPubs, forceAllVenuesInArea, hasSearchQuery, includeUnratedVenues, margin, marginEnabled, price, pubs, queryBoostPubs, searchRadius, selectedArea, selectedCity, showTouristHeavyBars, values, venueTypes]);

  useEffect(() => {
    const mapVisiblePool = !mapBounds
      ? filtered
      : filtered.filter(
          (pub) =>
            pub.lat <= mapBounds.north &&
            pub.lat >= mapBounds.south &&
            pub.lng <= mapBounds.east &&
            pub.lng >= mapBounds.west,
        );
    const selectionPool = view === "map" ? mapVisiblePool : filtered;

    if (view === "map" && hasSearchQuery) {
      if (filtered.length === 0) {
        setSelected(undefined);
        return;
      }

      setSelected((current) => {
        if (current && filtered.some((pub) => pub.id === current)) {
          return current;
        }

        return filtered[0].id;
      });
      return;
    }

    if (view === "map" && !effectiveHasSliderFilters) {
      if (selected && !mapVisiblePool.some((pub) => pub.id === selected)) {
        setSelected(undefined);
      }
      return;
    }

    if (selectionPool.length === 0 || (view === "map" && manualMapDeselected)) {
      setSelected(undefined);
      return;
    }

    setSelected((current) => {
      if (current && selectionPool.some((pub) => pub.id === current)) {
        return current;
      }

      if (current) {
        return undefined;
      }

      return selectionPool[0].id;
    });
  }, [effectiveHasSliderFilters, filtered, hasSearchQuery, manualMapDeselected, mapBounds, selected, view]);

  const pubsInCurrentMapView = useMemo(() => {
    if (hasSearchQuery) {
      return filtered;
    }

    if (!mapBounds) {
      return filtered;
    }

    return filtered.filter(
      (pub) =>
        pub.lat <= mapBounds.north &&
        pub.lat >= mapBounds.south &&
        pub.lng <= mapBounds.east &&
        pub.lng >= mapBounds.west,
    );
  }, [filtered, hasSearchQuery, mapBounds]);
  const selectedDrawerPub = pubsInCurrentMapView.find((p) => p.id === selected);
  const selectedPub = view === "map" ? selectedDrawerPub : filtered.find((p) => p.id === selected);

  useEffect(() => {
    displayMapCountRef.current = displayMapCount;
  }, [displayMapCount]);

  useEffect(() => {
    const end = pubsInCurrentMapView.length;
    const start = displayMapCountRef.current;
    if (start === end) {
      return;
    }

    const durationMs = 260;
    const startedAt = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const next = Math.round(start + (end - start) * progress);
      setDisplayMapCount(next);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [pubsInCurrentMapView.length]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || view !== "map") {
      return;
    }

    const updateHeight = () => setSheetHeight(sheet.offsetHeight);
    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(sheet);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, [filtered.length, placesLoading, view]);

  const handleTouchEnd = () => {
    const deltaY = startY.current - currentY.current;
    if (deltaY > 80) setView("list");
  };

  const handleUserButton = () => {
    if (user) navigate("/profile");
    else openAuthModal();
  };

  const handleLocate = () => {
    setLocated(true);
    setShowUnratedByTypeOnly(false);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const nextLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
          setUserLocation(nextLocation);
          setSearchCenter(nextLocation);
          setSearchAreaRadiusKm(null);
          setSearchAreaMode(false);
          setLastMapCenter(nextLocation);
          setTimeout(() => setLocated(false), 2500);
        },
        () => {
          setTimeout(() => setLocated(false), 2500);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 60000 },
      );
    } else {
      setTimeout(() => setLocated(false), 2500);
    }
  };

  const hasEnabledSliders = effectiveHasSliderFilters;
  const radiusLabel = Number.isFinite(activeSearchRadiusKm)
    ? formatDistance(activeSearchRadiusKm < 10 ? Number(activeSearchRadiusKm.toFixed(1)) : Math.round(activeSearchRadiusKm), distanceUnit, activeSearchRadiusKm < 10 ? 1 : 0)
    : "no radius limit";
  const scopeLabel =
    querySearchScope === "country"
      ? ` in ${selectedCountry}`
      : querySearchScope === "global"
        ? " worldwide"
        : "";
  const defaultSearchWindowLabel = formatDistance(25, distanceUnit, distanceUnit === "mi" ? 0 : 0);
  const resultSummary = `${filtered.length} ${filtered.length === 1 ? "place" : "places"}${
    hasSearchQuery
      ? scopeLabel
      : Number.isFinite(activeSearchRadiusKm)
      ? ` within ${radiusLabel} radius`
      : effectiveHasSliderFilters
        ? " with no radius limit"
        : ` within a ${defaultSearchWindowLabel} search window`
  }`;
  const mapViewSummary = `${displayMapCount} ${displayMapCount === 1 ? "place" : "places"}${
    Number.isFinite(activeSearchRadiusKm)
      ? ` in the current map view • ${radiusLabel} radius`
      : " in the current map view"
  }`;
  const isDrawerEmpty = !placesLoading && !externalLoading && !queryBoostLoading && pubsInCurrentMapView.length === 0;
  const isSearchingMorePlaces = externalLoading || queryBoostLoading;
  const movedDistanceKm = lastMapCenter
    ? haversineKm(searchCenter.lat, searchCenter.lng, lastMapCenter.lat, lastMapCenter.lng)
    : 0;
  const showSearchInArea = !showUnratedByTypeOnly && !areaDiscoveryMode && !hasSearchQuery && !!lastMapCenter && movedDistanceKm > 0.35;
  const handleSelectPub = useCallback((id: string) => {
    setManualMapDeselected(false);
    setSelected(id);
  }, []);
  const handleMapBackgroundClick = useCallback(() => {
    setSelected(undefined);
    setManualMapDeselected(true);
  }, []);
  const handleMapMoveEnd = useCallback(
    ({ lat, lng, bounds }: { lat: number; lng: number; zoom: number; bounds: { north: number; south: number; east: number; west: number } }) => {
      setLastMapCenter({ lat, lng });
      setMapBounds(bounds);
    },
    [],
  );

  const openRateForPub = (pub: Pub) => {
    if (pub.isExternalCandidate && pub.sourceProvider === "osm" && pub.sourcePlaceId) {
      const source = externalLookup.get(pub.sourcePlaceId);
      openRate(pub.id, {
        sourceProvider: "osm",
        sourcePlaceId: pub.sourcePlaceId,
        name: source?.name ?? pub.name,
        category: source?.category ?? (pub.category ?? "bar"),
        venueType: source?.venueType ?? pub.venueType ?? "bar",
        priceRange: null,
        address: source?.address ?? pub.address ?? pub.area,
        city: source?.city ?? pub.city,
        country: source?.country ?? pub.country ?? selectedCountry,
        latitude: source?.lat ?? pub.lat,
        longitude: source?.lng ?? pub.lng,
        imageUrl: source?.imageUrl ?? null,
        openingHours: source?.openingHours ?? pub.openingHours ?? null,
        phone: source?.phone ?? pub.phone ?? null,
        email: source?.email ?? pub.email ?? null,
        website: source?.website ?? pub.website ?? null,
      });
      return;
    }

    openRate(pub.id);
  };

  const openPlaceDetails = (pub: Pub) => {
    if (pub.isExternalCandidate) {
      const source = pub.sourcePlaceId ? externalLookup.get(pub.sourcePlaceId) : undefined;
      navigate(`/detail/${pub.id}`, {
        state: {
          externalPub: {
            ...pub,
            category: source?.category ?? (pub.category ?? "bar"),
            venueType: source?.venueType ?? pub.venueType ?? "bar",
            address: source?.address ?? pub.address ?? pub.area,
            city: source?.city ?? pub.city,
            country: source?.country ?? pub.country ?? selectedCountry,
            lat: source?.lat ?? pub.lat,
            lng: source?.lng ?? pub.lng,
            image: source?.imageUrl ?? pub.image,
            openingHours: source?.openingHours ?? pub.openingHours ?? null,
            phone: source?.phone ?? pub.phone ?? null,
            email: source?.email ?? pub.email ?? null,
            website: source?.website ?? pub.website ?? null,
          },
        },
      });
      return;
    }

    navigate(`/detail/${pub.id}`);
  };

  // Heights: BottomNav = 60px, bottom sheet max = 35%
  // Floating buttons sit 12px above sheet top at max expansion
  // bottom = 35% + 60px (nav) + 12px gap
  const mapBottomInsetPx = 60 + sheetHeight;
  const floatingBottom = `${mapBottomInsetPx + 20}px`;

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      {/* Top bar */}
      <div className="flex-none px-4 pt-3 pb-2 bg-gradient-to-b from-[#fbf8f3] via-[#fbf8f3]/95 to-transparent z-20">
        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search places, areas, or tags…"
              className="w-full pl-9 pr-16 py-2 rounded-full bg-white border border-gray-200 shadow-sm text-[13px] outline-none focus:border-gray-300"
            />
            {query.trim().length > 0 ? (
              <button
                onClick={() => setQuery("")}
                className="absolute right-9 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition-colors"
                aria-label="Clear search"
              >
                <span className="text-[11px] leading-none text-gray-600">x</span>
              </button>
            ) : null}
            <button
              onClick={() => navigate("/filter")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>

          {/* User button */}
          <button
            onClick={handleUserButton}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-none overflow-hidden"
          >
            {user ? (
              <div
                className="w-full h-full flex items-center justify-center text-white text-[11px]"
                style={{ background: `linear-gradient(135deg, ${user.gradientFrom}, ${user.gradientTo})` }}
              >
                {user.emoji}
              </div>
            ) : (
              <User className="w-4 h-4 text-gray-700" />
            )}
          </button>
        </div>

        {/* Active filter strip — tappable */}
        {hasEnabledSliders && (
          <button
            onClick={() => navigate("/filter")}
            className="w-full mt-3 pt-3 border-t border-gray-200/70 px-1 text-left"
          >
            <div className="flex gap-1">
              {SLIDERS.map((s) => {
                const isOn = enabled[s.key];
                return (
                  <div key={s.key} className="flex-1 h-1.5 rounded-full bg-gray-200/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: isOn ? `${values[s.key]}%` : "50%",
                        background: isOn ? s.color : "#d1d5db",
                        opacity: isOn ? 1 : 0.35,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-[1px]">
              {SLIDERS.map((s) => {
                const isOn = enabled[s.key];
                const label = values[s.key] > 50 ? s.right : s.left;
                return (
                  <div key={s.key} className="flex-1 text-center overflow-hidden">
                    <span className="text-[8px] leading-none" style={{ color: isOn ? s.color : "#d1d5db" }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 relative">
        {view === "map" ? (
          <>
            <MapView
              pubs={filtered}
              selected={selected}
              onSelect={handleSelectPub}
              located={located}
              userLocation={userLocation}
              mapCenter={lastMapCenter ?? searchCenter}
              focusYRatio={0.34}
              bottomInsetPx={mapBottomInsetPx}
              onMapMoveEnd={handleMapMoveEnd}
              onMapBackgroundClick={handleMapBackgroundClick}
            />

            {showSearchInArea && lastMapCenter ? (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30">
                <button
                  onClick={() => {
                    setSearchCenter(lastMapCenter);
                    setSearchAreaRadiusKm(mapBoundsRadiusKm ?? effectiveRadiusKm);
                    setSearchAreaMode(true);
                    setLastMapCenter(null);
                    setQuery("");
                    setDebouncedQuery("");
                  }}
                  className="px-4 py-2 rounded-full bg-white border border-gray-200 text-gray-800 shadow-md text-[12px]"
                >
                  Search in this area
                </button>
              </div>
            ) : null}

            {/* Floating action buttons above bottom sheet */}
            {selectedPub ? (
              <div
                className="absolute left-1/2 -translate-x-1/2 z-20"
                style={{ bottom: floatingBottom }}
              >
                <button
                  onClick={() => openRateForPub(selectedPub)}
                  className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-800 shadow-md text-[13px] flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Rate this place
                </button>
              </div>
            ) : null}

            <div
              className="absolute left-4 z-20"
              style={{ bottom: floatingBottom }}
            >
              <button
                onClick={() => {
                  setShowUnratedByTypeOnly((current) => {
                    const next = !current;
                    if (next) {
                      setSearchAreaMode(true);
                      setQuery("");
                      setDebouncedQuery("");
                    } else {
                      setSearchAreaMode(false);
                    }
                    return next;
                  });
                }}
                className={`w-10 h-10 rounded-full shadow-md border flex items-center justify-center transition-all duration-200 ${
                  showUnratedByTypeOnly
                    ? "bg-[#111827] border-[#111827] text-white"
                    : "bg-white border-gray-200 text-gray-700"
                }`}
                title={showUnratedByTypeOnly ? "Including unrated venues" : "Include unrated venues"}
              >
                {showUnratedByTypeOnly ? <Eye size={18} weight="fill" /> : <EyeSlash size={18} weight="regular" />}
              </button>
            </div>

            <div
              className="absolute right-4 z-20"
              style={{ bottom: floatingBottom }}
            >
              <button
                onClick={handleLocate}
                className={`w-10 h-10 rounded-full shadow-md border flex items-center justify-center transition-all duration-300 flex-none ${
                  located
                    ? "bg-blue-500 border-blue-400 text-white scale-95"
                    : "bg-white border-gray-200 text-gray-700"
                }`}
                title="Locate me"
              >
                <Crosshair
                  weight={located ? "fill" : "regular"}
                  size={18}
                  className={located ? "animate-pulse" : ""}
                />
              </button>
            </div>

            {/* Bottom sheet — sits above BottomNav (bottom-[60px]) */}
            <div
              ref={sheetRef}
              onTouchStart={(e) => { startY.current = e.touches[0].clientY; }}
              onTouchMove={(e) => { currentY.current = e.touches[0].clientY; }}
              onTouchEnd={handleTouchEnd}
              className="absolute left-0 right-0 z-20 bg-white rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.08)] border-t border-gray-100 max-h-[35%] overflow-hidden flex flex-col"
              style={{ bottom: "60px" }}
            >
              <div className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="pb-1 flex justify-center">
                {placesLoading && pubs.length === 0 ? (
                  <div className="flex items-center gap-1.5 text-[13px] text-gray-400">
                    <CircleNotch size={14} weight="bold" className="animate-spin text-amber-500" />
                    Loading places...
                  </div>
                ) : isSearchingMorePlaces ? (
                  <div className="flex items-center gap-1.5 text-[13px] text-gray-400">
                    <CircleNotch size={14} weight="bold" className="animate-spin text-amber-500" />
                    <span>
                      {displayMapCount} {displayMapCount === 1 ? "place" : "places"} found ·{" "}
                      {hasSearchQuery
                        ? "searching nearby first, then expanding..."
                        : "searching for more nearby..."}
                    </span>
                  </div>
                ) : externalPoolStale ? (
                  <div className="text-[12px] text-amber-600">
                    Live venue update is delayed, showing latest available results.
                  </div>
                ) : (
                  <div className="text-[13px] text-gray-400">{mapViewSummary}</div>
                )}
              </div>
              <div
                className={`${isDrawerEmpty ? "overflow-y-hidden" : "overflow-y-auto"} px-3 py-2 space-y-2 pb-8`}
              >
                {selectedDrawerPub && (
                  <PubCard
                    pub={selectedDrawerPub}
                    onClick={() => openPlaceDetails(selectedDrawerPub)}
                    selected
                    showMatchPill={hasEnabledSliders}
                  />
                )}
                {pubsInCurrentMapView
                  .filter((p) => p.id !== selectedDrawerPub?.id)
                  .map((p) => (
                    <PubCard
                      key={p.id}
                      pub={p}
                      onClick={() => openPlaceDetails(p)}
                      compact
                      showMatchPill={hasEnabledSliders}
                    />
                  ))}
                {isSearchingMorePlaces && pubsInCurrentMapView.length === 0 ? (
                  <>
                    <div className="animate-pulse bg-gray-100 border border-gray-200 rounded-2xl h-[84px]" />
                    <div className="animate-pulse bg-gray-100 border border-gray-200 rounded-2xl h-[84px]" />
                  </>
                ) : null}
                {!placesLoading && pubsInCurrentMapView.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="w-14 h-14 rounded-full bg-amber-50 flex items-center justify-center mb-2">
                      <MagnifyingGlassMinus size={28} weight="duotone" className="text-amber-500" />
                    </div>
                    <div className="text-gray-900 text-[14px]">No matches right now</div>
                    <div className="text-[12px] text-gray-500 mt-1 max-w-[220px]">
                      Hey, seems you are one of a kind. Try widening your filters.
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 overflow-y-auto px-3 py-3 space-y-2 pb-[120px] bg-[#fbf8f3]">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-[14px] text-gray-900">{resultSummary}</div>
              <button
                onClick={() => setView("map")}
                className="text-[12px] text-gray-600 px-3 py-1.5 rounded-full bg-white border border-gray-200"
              >
                ← Back to map
              </button>
            </div>
            {isSearchingMorePlaces ? (
              <div className="flex items-center gap-2 text-[12px] text-gray-500 px-1 mb-1">
                <CircleNotch size={14} weight="bold" className="animate-spin text-amber-500" />
                {hasSearchQuery
                  ? "Searching nearby first, then expanding..."
                  : "Searching for more places nearby..."}
              </div>
            ) : null}
            {filtered.map((p, i) => {
              const isSearching = query.trim().length > 0;
              // Search results: show ad after 2nd result
              const showSearchAd = isSearching && i === 2;
              // List view: show ad after every 3rd card (when not searching)
              const showListAd = !isSearching && i > 0 && i % 3 === 0;

              return (
                <div key={p.id}>
                  {showSearchAd && <AdUnit variant="native" className="mb-2" />}
                  <PubCard pub={p} onClick={() => openPlaceDetails(p)} showMatchPill={hasEnabledSliders} />
                  {showListAd && <AdUnit variant="native" className="mt-2" />}
                </div>
              );
            })}
            {!filtered.length && (
              <div className="flex flex-col items-center justify-center py-14 text-center">
                <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mb-3">
                  <MagnifyingGlassMinus size={32} weight="duotone" className="text-amber-500" />
                </div>
                <div className="text-gray-900">No matches right now</div>
                <div className="text-[13px] text-gray-500 mt-1">Hey, seems you are one of a kind. Try broader filters.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <BottomNav />
    </div>
  );
}
