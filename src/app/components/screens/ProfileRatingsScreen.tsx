import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft } from "lucide-react";
import { Star, Trash } from "@phosphor-icons/react";

import { deleteOwnRating, getRatingsByUserPaged } from "@/lib/services/places";
import type { PlaceRatingRecord } from "@/types/place";
import { useAuth } from "../../context/AuthContext";
import { usePlaces } from "../../context/PlacesContext";
import { BottomNav } from "../BottomNav";
import { AuthScreen } from "./AuthScreen";

const PAGE_SIZE = 20;

const CONTRIBUTION_TRAITS: Array<{
  key: keyof Pick<
    PlaceRatingRecord,
    "classic_modern" | "quiet_lively" | "cheap_premium" | "local_touristy" | "cozy_spacious"
  >;
  color: string;
}> = [
  { key: "classic_modern", color: "#F59E0B" },
  { key: "quiet_lively", color: "#EF4444" },
  { key: "cheap_premium", color: "#10B981" },
  { key: "local_touristy", color: "#3B82F6" },
  { key: "cozy_spacious", color: "#8B5CF6" },
];

function RatingCard({
  rating,
  placeName,
  onOpenPlace,
  onDelete,
  deleting,
}: {
  rating: PlaceRatingRecord;
  placeName: string;
  onOpenPlace: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div className="relative">
      <div className="absolute top-2 right-2 z-10">
        <button
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          className="w-7 h-7 rounded-full bg-red-50 border border-red-100 text-red-600 flex items-center justify-center disabled:opacity-60"
          aria-label="Delete rating"
          title="Delete rating"
        >
          <Trash size={13} weight="duotone" />
        </button>
      </div>

      <button
        onClick={onOpenPlace}
        className="relative w-full text-left bg-white rounded-2xl border border-gray-100 p-3 pr-12 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
      >
        <div className="text-[13px] text-gray-900 truncate">{placeName}</div>
        <div className="text-[11px] text-gray-500 mt-0.5">{new Date(rating.updated_at).toLocaleDateString()}</div>
        <div className="mt-2 p-2 rounded-xl border border-gray-100 bg-gray-50">
          <div className="text-center text-[11px] text-gray-500 mb-1.5">Your contribution</div>
          <div className="space-y-1">
            {CONTRIBUTION_TRAITS.map((trait) => (
              <div key={trait.key} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full flex-none" style={{ background: trait.color }} />
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden flex-1">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${rating[trait.key]}%`, background: trait.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
        {rating.note ? (
          <div className="text-[12px] text-gray-700 mt-2 line-clamp-2">{rating.note}</div>
        ) : null}
      </button>
    </div>
  );
}

export function ProfileRatingsScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pubs } = usePlaces();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const [ratings, setRatings] = useState<PlaceRatingRecord[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextPage, setNextPage] = useState(1);
  const [deletingRatingId, setDeletingRatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const placeById = useMemo(() => new Map(pubs.map((pub) => [pub.id, pub])), [pubs]);

  const loadPage = useCallback(
    async (page: number, append: boolean) => {
      if (!user) {
        return;
      }
      const chunk = await getRatingsByUserPaged(user.id, page, PAGE_SIZE);
      setRatings((previous) => (append ? [...previous, ...chunk] : chunk));
      setHasMore(chunk.length === PAGE_SIZE);
      setNextPage(page + 1);
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      setRatings([]);
      setLoadingInitial(false);
      setLoadingMore(false);
      setHasMore(false);
      setNextPage(1);
      return;
    }

    let cancelled = false;
    setLoadingInitial(true);
    setError(null);
    setHasMore(true);
    setNextPage(1);

    loadPage(0, false)
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load ratings.");
          setRatings([]);
          setHasMore(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingInitial(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadPage, user]);

  const handleLoadMore = useCallback(async () => {
    if (!user || loadingInitial || loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);
    try {
      await loadPage(nextPage, true);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load more ratings.");
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  }, [hasMore, loadPage, loadingInitial, loadingMore, nextPage, user]);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const remaining = element.scrollHeight - element.scrollTop - element.clientHeight;
    if (remaining < 320) {
      void handleLoadMore();
    }
  }, [handleLoadMore]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || loadingInitial || loadingMore || !hasMore) {
      return;
    }
    if (element.scrollHeight <= element.clientHeight + 24) {
      void handleLoadMore();
    }
  }, [handleLoadMore, hasMore, loadingInitial, loadingMore, ratings.length]);

  const handleDeleteRating = async (ratingId: string) => {
    if (!user || deletingRatingId) {
      return;
    }
    setDeletingRatingId(ratingId);
    try {
      await deleteOwnRating(user.id, ratingId);
      setRatings((previous) => previous.filter((entry) => entry.id !== ratingId));
    } finally {
      setDeletingRatingId(null);
    }
  };

  if (!user) {
    return <AuthScreen profileMode />;
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 bg-white/70 backdrop-blur border-b border-gray-100 z-10">
        <button
          onClick={() => navigate("/profile")}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
          aria-label="Back to profile"
        >
          <ArrowLeft className="w-4 h-4 text-gray-700" />
        </button>
        <div className="text-gray-900 text-[16px]">All ratings</div>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 pt-4 pb-[84px]">
        {loadingInitial ? (
          <div className="text-center text-[13px] text-gray-500 py-10">Loading ratings...</div>
        ) : ratings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
            <div className="text-[13px] text-gray-900">No ratings yet</div>
            <div className="text-[12px] text-gray-500 mt-1">Your future ratings will show up here.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {ratings.map((rating) => {
              const placeName = placeById.get(rating.place_id)?.name ?? "Place";
              return (
                <RatingCard
                  key={rating.id}
                  rating={rating}
                  placeName={placeName}
                  onOpenPlace={() => navigate(`/detail/${rating.place_id}`)}
                  onDelete={() => void handleDeleteRating(rating.id)}
                  deleting={deletingRatingId === rating.id}
                />
              );
            })}
            {loadingMore ? (
              <div className="text-center text-[12px] text-gray-500 py-2">Loading more...</div>
            ) : null}
            {!loadingMore && hasMore ? (
              <div className="text-center text-[11px] text-gray-400 py-2">Scroll for more</div>
            ) : null}
            {!hasMore && ratings.length > 0 ? (
              <div className="text-center text-[11px] text-gray-400 py-2">You reached the end.</div>
            ) : null}
          </div>
        )}

        {error ? (
          <div className="mt-3 text-center text-[12px] text-red-500">{error}</div>
        ) : null}
      </div>

      <BottomNav />
    </div>
  );
}
