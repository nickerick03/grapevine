import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import { useAuth } from "@/app/context/AuthContext";
import { AdSlot } from "@/components/common/AdSlot";
import { Chip } from "@/components/common/Chip";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { PlaceMiniMap } from "@/components/map/PlaceMiniMap";
import { PlaceCard } from "@/components/places/PlaceCard";
import { SavePlaceButton } from "@/components/places/SavePlaceButton";
import { VibeProfile } from "@/components/places/VibeProfile";
import { generatePlaceChips } from "@/lib/chips";
import { buildEmptySummary } from "@/lib/place-summary";
import {
  getPlaceWithSummaryBySlug,
  getRatingsForPlace,
  getSavedPlaceIds,
  getSimilarPlaces,
  savePlace,
  unsavePlace,
} from "@/lib/services/places";
import { generatePlaceSummary } from "@/lib/summary";
import type { PlaceRatingRecord, PlaceRecord, PlaceVibeSummary, PlaceWithSummary } from "@/types/place";

export function PlaceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, openAuthModal } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<PlaceRecord | null>(null);
  const [summary, setSummary] = useState<PlaceVibeSummary | null>(null);
  const [similar, setSimilar] = useState<PlaceWithSummary[]>([]);
  const [ratings, setRatings] = useState<PlaceRatingRecord[]>([]);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const slugValue = slug;

    if (!slugValue) {
      setError("Missing place slug.");
      setLoading(false);
      return;
    }
    const ensuredSlug: string = slugValue;

    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const data = await getPlaceWithSummaryBySlug(ensuredSlug);

        if (!data) {
          throw new Error("Place not found.");
        }

        const [nextRatings, nextSimilar] = await Promise.all([
          getRatingsForPlace(data.place.id, 30),
          getSimilarPlaces(data.place.id, 4),
        ]);

        let saved = false;

        if (user) {
          const savedIds = await getSavedPlaceIds(user.id);
          saved = savedIds.includes(data.place.id);
        }

        if (cancelled) return;

        setPlace(data.place);
        setSummary(data.summary);
        setRatings(nextRatings);
        setSimilar(nextSimilar);
        setIsSaved(saved);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load place details.");
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
  }, [slug, user]);

  const activeSummary = useMemo(() => {
    if (summary) {
      return summary;
    }

    if (place) {
      return buildEmptySummary(place);
    }

    return null;
  }, [place, summary]);

  const chips = useMemo(() => {
    if (!activeSummary) {
      return [];
    }

    return generatePlaceChips(activeSummary);
  }, [activeSummary]);

  const notes = useMemo(() => ratings.filter((rating) => Boolean(rating.note?.trim())).slice(0, 6), [ratings]);

  async function handleToggleSave() {
    if (!place) {
      return { error: "Place not loaded." };
    }

    if (!user) {
      openAuthModal();
      return { error: "Please sign in to save places." };
    }

    try {
      if (isSaved) {
        await unsavePlace(user.id, place.id);
        setIsSaved(false);
      } else {
        await savePlace(user.id, place.id);
        setIsSaved(true);
      }

      return { error: null };
    } catch (saveError) {
      return {
        error: saveError instanceof Error ? saveError.message : "Could not update saved places.",
      };
    }
  }

  if (loading) {
    return (
      <div className="absolute inset-0 overflow-y-auto px-4 py-4 pb-[76px]">
        <LoadingState label="Loading place details..." />
      </div>
    );
  }

  if (error || !place || !activeSummary) {
    return (
      <div className="absolute inset-0 overflow-y-auto px-4 py-4 pb-[76px]">
        <EmptyState title="Place unavailable" message={error ?? "This place could not be found."} />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto space-y-4 bg-[#fbf8f3] px-4 py-4 pb-[76px]">
      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[12px] uppercase tracking-wide text-gray-500">{place.category}</p>
            <h1 className="text-[28px] tracking-tight text-gray-900">{place.name}</h1>
            <p className="text-[13px] text-gray-500">
              {place.address ?? "Address unavailable"}, {place.city}, {place.country}
            </p>
            {place.description ? <p className="mt-2 text-[14px] text-gray-700">{place.description}</p> : null}
          </div>

          <div className="flex gap-2">
            <Link to={`/places/${place.slug}/rate`} className="rounded-full bg-gray-900 px-4 py-2 text-[13px] text-white">
              Rate this place
            </Link>
            <SavePlaceButton isSaved={isSaved} onToggle={handleToggleSave} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <Chip key={chip} label={chip} />
          ))}
        </div>
      </section>

      <VibeProfile
        summary={activeSummary}
        ratingCount={activeSummary.rating_count}
        summarySentence={generatePlaceSummary(activeSummary)}
      />

      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <h2 className="mb-2 text-[18px] text-gray-900">Location</h2>
        <PlaceMiniMap latitude={place.latitude} longitude={place.longitude} name={place.name} />
      </section>

      <p className="text-[12px] text-gray-500">
        Place profiles are based on community impressions and may change over time.
      </p>

      <AdSlot label="Ad placement reserved" />

      <section className="space-y-3">
        <h2 className="text-[20px] text-gray-900">Similar places</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {similar.map((entry) => (
            <PlaceCard key={entry.place.id} place={entry.place} summary={entry.summary} />
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
        <h2 className="mb-2 text-[18px] text-gray-900">Micro-comments</h2>
        {notes.length === 0 ? (
          <p className="text-[13px] text-gray-500">No notes yet. Add one when you submit a rating.</p>
        ) : (
          <div className="space-y-2">
            {notes.map((rating) => (
              <article key={rating.id} className="rounded-2xl bg-gray-50 p-3">
                <div className="flex items-center justify-between text-[11px] text-gray-500">
                  <span>User {rating.user_id.slice(0, 8)}</span>
                  <span>{rating.visit_context ?? "Visit time not set"}</span>
                </div>
                <p className="mt-1 text-[13px] text-gray-700">{rating.note}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
