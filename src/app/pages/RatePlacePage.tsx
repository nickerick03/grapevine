import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";

import { useAuth } from "@/app/context/AuthContext";
import { EmptyState } from "@/components/common/EmptyState";
import { LoadingState } from "@/components/common/LoadingState";
import { RatingForm } from "@/components/rating/RatingForm";
import { buildEmptySummary } from "@/lib/place-summary";
import {
  getPlaceWithSummaryBySlug,
  getUserRatingForPlace,
  upsertPlaceRating,
} from "@/lib/services/places";
import { vibeValuesFromRating, vibeValuesFromSummary } from "@/lib/vibe-values";
import type { PlaceRatingRecord, PlaceRecord, PlaceVibeSummary } from "@/types/place";

export function RatePlacePage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [place, setPlace] = useState<PlaceRecord | null>(null);
  const [summary, setSummary] = useState<PlaceVibeSummary | null>(null);
  const [existingRating, setExistingRating] = useState<PlaceRatingRecord | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
        const result = await getPlaceWithSummaryBySlug(ensuredSlug);

        if (!result) {
          throw new Error("Place not found.");
        }

        let nextRating: PlaceRatingRecord | null = null;

        if (user) {
          nextRating = await getUserRatingForPlace(result.place.id, user.id);
        }

        if (cancelled) return;

        setPlace(result.place);
        setSummary(result.summary);
        setExistingRating(nextRating);
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load rating form.");
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

  const initialValues = useMemo(() => {
    if (existingRating) {
      return vibeValuesFromRating(existingRating);
    }

    if (summary) {
      return vibeValuesFromSummary(summary);
    }

    if (place) {
      return vibeValuesFromSummary(buildEmptySummary(place));
    }

    return {
      classic_modern: 50,
      quiet_lively: 50,
      cheap_premium: 50,
      local_touristy: 50,
      cozy_spacious: 50,
    };
  }, [existingRating, place, summary]);

  if (loading) {
    return (
      <div className="absolute inset-0 overflow-y-auto px-4 py-4 pb-[76px]">
        <LoadingState label="Loading rating form..." />
      </div>
    );
  }

  if (error || !place) {
    return (
      <div className="absolute inset-0 overflow-y-auto px-4 py-4 pb-[76px]">
        <EmptyState title="Could not open rating form" message={error ?? "Unknown error"} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="absolute inset-0 overflow-y-auto space-y-4 bg-[#fbf8f3] px-4 py-4 pb-[76px]">
        <EmptyState
          title="Sign in required"
          message="Please sign in to submit or update your rating for this place."
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openAuthModal()} className="rounded-full bg-gray-900 px-4 py-2 text-[13px] text-white">
            Sign in with magic link
          </button>
          <Link to={`/places/${place.slug}`} className="rounded-full border border-gray-200 bg-white px-4 py-2 text-[13px] text-gray-800">
            Back to place
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-y-auto space-y-4 bg-[#fbf8f3] px-4 py-4 pb-[76px]">
      <div className="space-y-1">
        <h1 className="text-[28px] tracking-tight text-gray-900">Rate {place.name}</h1>
        <p className="text-[13px] text-gray-500">
          {existingRating ? "Update your previous rating." : "Share your impression to improve this profile."}
        </p>
      </div>

      <RatingForm
        initialValues={initialValues}
        initialVisitContexts={existingRating?.visit_contexts ?? null}
        initialVisitContext={existingRating?.visit_context ?? null}
        initialNote={existingRating?.note ?? null}
        submitting={submitting}
        onSubmit={async ({ values, visit_contexts, visit_context, note }) => {
          setSubmitting(true);

          try {
            await upsertPlaceRating({
              place_id: place.id,
              user_id: user.id,
              classic_modern: values.classic_modern,
              quiet_lively: values.quiet_lively,
              cheap_premium: values.cheap_premium,
              local_touristy: values.local_touristy,
              cozy_spacious: values.cozy_spacious,
              visit_contexts,
              visit_context,
              note,
            });

            setTimeout(() => {
              navigate(`/places/${place.slug}`);
            }, 900);

            return { error: null };
          } catch (submitError) {
            return {
              error: submitError instanceof Error ? submitError.message : "Failed to save your rating.",
            };
          } finally {
            setSubmitting(false);
          }
        }}
      />

      <Link to={`/places/${place.slug}`} className="inline-flex text-[13px] text-gray-600 hover:text-gray-900">
        ← Back to place profile
      </Link>
    </div>
  );
}
