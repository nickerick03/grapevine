import { useEffect, useState } from "react";

import { useAuth } from "@/app/context/AuthContext";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PlaceCard } from "@/components/places/PlaceCard";
import { buildEmptySummary } from "@/lib/place-summary";
import { getAllPlaceSummaries, getSavedPlaces } from "@/lib/services/places";
import type { PlaceRecord, PlaceVibeSummary } from "@/types/place";

export function SavedPage() {
  const { user, openAuthModal } = useAuth();
  const [loading, setLoading] = useState(true);
  const [places, setPlaces] = useState<PlaceRecord[]>([]);
  const [summaryMap, setSummaryMap] = useState<Map<string, PlaceVibeSummary>>(new Map());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setPlaces([]);
      setSummaryMap(new Map());
      return;
    }
    const userId = user.id;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const saved = await getSavedPlaces(userId);
        const summaries = await getAllPlaceSummaries(saved.map((place) => place.id));

        if (cancelled) return;

        setPlaces(saved);
        setSummaryMap(new Map(summaries.map((summary) => [summary.place_id, summary])));
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load saved places.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) {
    return (
      <div className="absolute inset-0 overflow-y-auto px-4 pt-4 pb-[76px]">
        <EmptyState title="Sign in required" message="Sign in to save places and access them here." />
        <button onClick={() => openAuthModal()} className="mt-3 rounded-full bg-gray-900 px-4 py-2 text-[13px] text-white">
          Sign in with magic link
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="absolute inset-0 overflow-y-auto px-4 pt-4 pb-[76px]">
        <LoadingState label="Loading saved places..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 overflow-y-auto px-4 pt-4 pb-[76px]">
        <EmptyState title="Could not load saved places" message={error} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto px-4 pt-4 pb-[76px] space-y-3 bg-[#fbf8f3]">
      <h1 className="text-[22px] text-gray-900">Saved places</h1>
      {places.length === 0 ? (
        <EmptyState title="No saved places yet" message="Save places from detail pages to find them here." />
      ) : (
        places.map((place) => (
          <PlaceCard key={place.id} place={place} summary={summaryMap.get(place.id) ?? buildEmptySummary(place)} />
        ))
      )}
    </div>
  );
}
