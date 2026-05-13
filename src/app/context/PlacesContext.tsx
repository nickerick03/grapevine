import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { generatePlaceChips } from "@/lib/chips";
import { buildEmptySummary } from "@/lib/place-summary";
import { getAllPlaceSummaries, getPlaces } from "@/lib/services/places";
import { generatePlaceSummary } from "@/lib/summary";
import { supabase } from "@/lib/supabase/client";
import type { PlaceRecord, PlaceVibeSummary } from "@/types/place";

import { type Pub } from "../components/vibe";

interface PlacesContextType {
  pubs: Pub[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  placeById: Map<string, PlaceRecord>;
  summaryById: Map<string, PlaceVibeSummary>;
}

const LOAD_TIMEOUT_MS = 12000;

const PlacesContext = createContext<PlacesContextType>({
  pubs: [],
  loading: false,
  error: null,
  refresh: async () => {},
  placeById: new Map(),
  summaryById: new Map(),
});

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<T>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out.`));
    }, LOAD_TIMEOUT_MS);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function placeToPub(place: PlaceRecord, summary: PlaceVibeSummary): Pub {
  return {
    id: place.id,
    slug: place.slug,
    category: place.category,
    venueType: place.venue_type,
    priceRange: summary.avg_price_range != null ? Math.max(1, Math.min(4, Math.round(summary.avg_price_range))) as 1 | 2 | 3 | 4 : null,
    address: place.address ?? "",
    country: place.country,
    sourceProvider: place.source_provider ?? undefined,
    sourcePlaceId: place.source_place_id ?? undefined,
    openingHours: place.opening_hours ?? null,
    phone: place.phone ?? null,
    email: place.email ?? null,
    website: place.website ?? null,
    isExternalCandidate: false,
    name: place.name,
    area: place.address ?? "Area not set",
    city: place.city,
    summary: generatePlaceSummary(summary),
    chips: generatePlaceChips(summary),
    match: 80,
    ratings: summary.rating_count,
    vibe: {
      modern: summary.avg_classic_modern ?? 50,
      lively: summary.avg_quiet_lively ?? 50,
      premium: summary.avg_cheap_premium ?? 50,
      touristy: summary.avg_local_touristy ?? 50,
      spacious: summary.avg_cozy_spacious ?? 50,
    },
    image: place.image_url ?? "",
    lat: place.latitude,
    lng: place.longitude,
  };
}

export function PlacesProvider({ children }: { children: ReactNode }) {
  const [pubs, setPubs] = useState<Pub[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [placeById, setPlaceById] = useState<Map<string, PlaceRecord>>(new Map());
  const [summaryById, setSummaryById] = useState<Map<string, PlaceVibeSummary>>(new Map());

  const refresh = useCallback(async () => {
    const hasSupabaseKeys = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

    if (!hasSupabaseKeys) {
      setError("Supabase environment variables are missing.");
      setPubs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const places = await withTimeout(getPlaces(), "Places fetch");
      const summaries = await withTimeout(
        getAllPlaceSummaries(places.map((place) => place.id)),
        "Summary fetch",
      );
      const summaryMap = new Map(summaries.map((summary) => [summary.place_id, summary]));

      const nextPubs = places.map((place) => {
        const summary = summaryMap.get(place.id) ?? buildEmptySummary(place);
        return placeToPub(place, summary);
      });

      setPubs(nextPubs);
      setPlaceById(new Map(places.map((place) => [place.id, place])));
      setSummaryById(summaryMap);
    } catch (loadError) {
      setPubs([]);
      setError(loadError instanceof Error ? loadError.message : "Failed to load places from Supabase.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = () => {
      // Coalesce bursty updates (e.g. rating + place metadata update) into one reload.
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      refreshTimer = setTimeout(() => {
        void refresh();
      }, 180);
    };

    const channel = supabase
      .channel("places-live-updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "place_ratings" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "places" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
      }
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const value = useMemo(
    () => ({
      pubs,
      loading,
      error,
      refresh,
      placeById,
      summaryById,
    }),
    [error, loading, placeById, pubs, refresh, summaryById],
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export const usePlaces = () => useContext(PlacesContext);
