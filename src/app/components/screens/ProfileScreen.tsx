import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Settings } from "lucide-react";
import { Star, Bookmark, MapPin, PencilSimple, Plus, Trophy, Trash, CaretDown } from "@phosphor-icons/react";
import type { PlaceRatingRecord } from "@/types/place";
import { useAuth } from "../../context/AuthContext";
import { usePlaces } from "../../context/PlacesContext";
import { AdUnit } from "../AdUnit";
import { BottomNav } from "../BottomNav";
import { deleteOwnRating, getRatingsByUser, getSavedPlaceIds } from "@/lib/services/places";
import { getGrapevineScoreByUserId, type GrapevineScoreBreakdown } from "@/lib/services/profile";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { type Pub } from "../vibe";
import { AuthScreen } from "./AuthScreen";
import { formatPubAddress } from "../placeAddress";

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

export function ProfileScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { pubs } = usePlaces();
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [ratingCount, setRatingCount] = useState(0);
  const [userRatings, setUserRatings] = useState<PlaceRatingRecord[]>([]);
  const [deletingRatingId, setDeletingRatingId] = useState<string | null>(null);
  const [pendingDeleteRatingId, setPendingDeleteRatingId] = useState<string | null>(null);
  const [scoreExpanded, setScoreExpanded] = useState(false);
  const [scoreBreakdown, setScoreBreakdown] = useState<GrapevineScoreBreakdown>({
    baseScore: 0,
    cupRewardPoints: 0,
    grapevineScore: 0,
    helpfulVotesReceived: 0,
    firstRatingsSubmitted: 0,
    uniqueCitiesCovered: 0,
    reviewsSubmitted: 0,
    notesSubmitted: 0,
  });

  useEffect(() => {
    if (!user) {
      setSavedIds([]);
      setRatingCount(0);
      setUserRatings([]);
      return;
    }
    const userId = user.id;

    let cancelled = false;

    async function loadProfileActivity() {
      try {
        const [ids, ratings, score] = await Promise.all([
          getSavedPlaceIds(userId),
          getRatingsByUser(userId, 100),
          getGrapevineScoreByUserId(userId),
        ]);
        if (!cancelled) {
          setSavedIds(ids);
          setRatingCount(ratings.length);
          setUserRatings(ratings.slice(0, 12));
          setScoreBreakdown(score);
        }
      } catch {
        if (!cancelled) {
          setSavedIds([]);
          setRatingCount(0);
          setUserRatings([]);
          setScoreBreakdown({
            baseScore: 0,
            cupRewardPoints: 0,
            grapevineScore: 0,
            helpfulVotesReceived: 0,
            firstRatingsSubmitted: 0,
            uniqueCitiesCovered: 0,
            reviewsSubmitted: 0,
            notesSubmitted: 0,
          });
        }
      }
    }

    loadProfileActivity();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const savedPlaces = useMemo<Pub[]>(
    () =>
      savedIds
        .map((id) => pubs.find((pub) => pub.id === id))
        .filter((pub): pub is Pub => Boolean(pub)),
    [pubs, savedIds],
  );
  const cityCount = useMemo(() => new Set(savedPlaces.map((pub) => pub.city)).size, [savedPlaces]);
  const ratedPlacesById = useMemo(() => new Map(pubs.map((pub) => [pub.id, pub])), [pubs]);
  const profileUsername = useMemo(() => {
    const rawUsername = (user?.username ?? "").replace(/^@+/, "").trim();
    if (rawUsername) {
      return `@${rawUsername}`;
    }

    const fromEmail = user?.email?.split("@")[0]?.trim();
    if (fromEmail) {
      return `@${fromEmail}`;
    }

    return user?.name ?? "User";
  }, [user?.email, user?.name, user?.username]);

  const handleDeleteRating = async (ratingId: string) => {
    if (!user || deletingRatingId) {
      return;
    }
    setDeletingRatingId(ratingId);
    try {
      await deleteOwnRating(user.id, ratingId);
      setUserRatings((previous) => previous.filter((entry) => entry.id !== ratingId));
      setRatingCount((count) => Math.max(0, count - 1));
    } finally {
      setDeletingRatingId(null);
    }
  };

  useEffect(() => {
    if (!pendingDeleteRatingId) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPendingDeleteRatingId(null);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [pendingDeleteRatingId]);

  if (!user) {
    return <AuthScreen profileMode />;
  }

  const scoreLines = [
    { label: "Helpful votes received", value: scoreBreakdown.helpfulVotesReceived, weight: 0.1 },
    { label: "First ratings on unrated places", value: scoreBreakdown.firstRatingsSubmitted, weight: 5 },
    { label: "Unique cities covered", value: scoreBreakdown.uniqueCitiesCovered, weight: 10 },
    { label: "Reviews submitted", value: scoreBreakdown.reviewsSubmitted, weight: 1 },
    { label: "Notes submitted", value: scoreBreakdown.notesSubmitted, weight: 3 },
    { label: "Cup placement rewards", value: scoreBreakdown.cupRewardPoints, weight: 1, directPoints: true },
  ];

  const formatScore = (value: number) => {
    const rounded = Math.round(value * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      <div className="flex-none flex items-center justify-between px-4 pt-3 pb-2 bg-white/70 backdrop-blur border-b border-gray-100 z-10">
        <div className="w-9" />
        <div className="text-gray-900 text-[16px]">Profile</div>
        <button
          onClick={() => navigate("/settings")}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <Settings className="w-4 h-4 text-gray-600" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-6 pb-4">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.05)] p-5">
            <div className="flex items-center gap-4">
              <div
                className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl shadow-lg flex-none"
                style={{ background: `linear-gradient(135deg, ${user.gradientFrom}, ${user.gradientTo})` }}
              >
                {user.profilePhoto ? (
                  <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover rounded-2xl" />
                ) : (
                  user.emoji
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-gray-900 text-[17px]">{profileUsername}</div>
                <div className="text-[12px] text-gray-500 mt-0.5 truncate">{user.email}</div>
                <button
                  onClick={() => navigate("/edit-profile")}
                  className="mt-2 flex items-center gap-1 text-[12px] text-gray-600 px-3 py-1 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                  <PencilSimple size={12} /> Edit profile
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-gray-100">
              {[
                { icon: <Star weight="duotone" size={16} className="text-amber-500" />, value: String(ratingCount), label: "Ratings" },
                { icon: <Bookmark weight="duotone" size={16} className="text-blue-500" />, value: String(savedPlaces.length), label: "Saved" },
                { icon: <MapPin weight="duotone" size={16} className="text-emerald-500" />, value: String(cityCount), label: "Cities" },
              ].map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="flex items-center justify-center gap-1 mb-0.5">
                    {stat.icon}
                    <span className="text-gray-900">{stat.value}</span>
                  </div>
                  <div className="text-[11px] text-gray-500">{stat.label}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate("/leaderboard")}
              className="mt-4 w-full py-2.5 rounded-xl bg-gray-900 text-white text-[13px] flex items-center justify-center gap-2"
            >
              <Trophy weight="duotone" size={16} />
              Open leaderboard
            </button>

            <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
              <button
                onClick={() => setScoreExpanded((previous) => !previous)}
                className="w-full flex items-center justify-between"
                aria-expanded={scoreExpanded}
              >
                <div className="text-[12px] text-gray-700">Grapevine Score</div>
                <div className="flex items-center gap-1.5 text-gray-900">
                  <span className="text-[16px]">{formatScore(scoreBreakdown.grapevineScore)}</span>
                  <CaretDown
                    size={14}
                    className={`text-gray-500 transition-transform ${scoreExpanded ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
              {scoreExpanded ? (
                <>
                  <div className="mt-2 space-y-1">
                    {scoreLines.map((line) => (
                      <div key={line.label} className="flex items-center justify-between text-[11px] text-gray-600">
                        <span className="truncate pr-2">
                          {line.directPoints ? `${line.label}` : `${line.label} (${line.value}) × ${line.weight}`}
                        </span>
                        <span className="text-gray-700">
                          +{formatScore(line.directPoints ? line.value : line.value * line.weight)}
                        </span>
                      </div>
                    ))}
                  </div>
                  {user.hideScore ? (
                    <div className="mt-2 text-[10.5px] text-purple-600">
                      Hidden from public leaderboard by your privacy setting.
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>
        </div>

        {/* Add New Place CTA — hidden, kept for future use */}
        {false && (
          <div className="px-4 pb-4">
            <button
              onClick={() => navigate("/add-place")}
              className="w-full flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              <div className="w-9 h-9 rounded-xl bg-gray-900 flex items-center justify-center flex-none">
                <Plus size={18} weight="bold" className="text-white" />
              </div>
              <div className="flex-1 text-left">
                <div className="text-[14px] text-gray-900">Add a new place</div>
                <div className="text-[11px] text-gray-500 mt-0.5">
                  Pin it on the map & fill in the details
                </div>
              </div>
              <MapPin size={16} className="text-gray-400" />
            </button>
          </div>
        )}

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 text-gray-700">
              <Bookmark weight="duotone" size={16} className="text-blue-500" />
              Saved places
            </div>
            <button onClick={() => navigate("/saved")} className="text-[12px] text-gray-500">
              See all
            </button>
          </div>
          {savedPlaces.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
              <div className="text-[13px] text-gray-900">No saved places yet</div>
              <div className="text-[12px] text-gray-500 mt-1">Start bookmarking places from Explore.</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {savedPlaces.map((pub) => (
                <button
                  key={pub.id}
                  onClick={() => navigate(`/detail/${pub.id}`)}
                  className="text-left bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
                >
                  <ImageWithFallback src={pub.image} alt={pub.name} className="w-full h-20 object-cover" />
                  <div className="p-2.5">
                    <div className="text-[12px] text-gray-900 truncate">{pub.name}</div>
                    <div className="text-[10px] text-gray-500 mt-0.5 flex items-center gap-1">
                      <MapPin size={9} className="text-blue-400" />
                      <span className="truncate">{formatPubAddress(pub)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 pb-3">
          <AdUnit variant="native" />
        </div>

        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-2 px-1">
            <div className="flex items-center gap-2 text-gray-700">
              <Star weight="duotone" size={16} className="text-amber-500" />
              Ratings
            </div>
          </div>
          <div className="space-y-2.5">
            {userRatings.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 text-center">
                <div className="text-[13px] text-gray-900">No ratings yet</div>
                <div className="text-[12px] text-gray-500 mt-1">Rate places to build your profile history.</div>
              </div>
            ) : (
              <div className="space-y-2">
                {userRatings.map((rating) => {
                  const ratedPlace = ratedPlacesById.get(rating.place_id);
                  return (
                    <RatingCard
                      key={rating.id}
                      rating={rating}
                      placeName={ratedPlace?.name ?? "Place"}
                      onOpenPlace={() => navigate(`/detail/${rating.place_id}`)}
                      onDelete={() => setPendingDeleteRatingId(rating.id)}
                      deleting={deletingRatingId === rating.id}
                    />
                  );
                })}
              </div>
            )}
            <button
              onClick={() => navigate("/profile/ratings")}
              className="w-full py-2.5 rounded-xl border border-gray-200 bg-white text-[13px] text-gray-700"
            >
              Show all my ratings
            </button>
          </div>
        </div>

        <div className="pb-[84px]" />
      </div>

      <BottomNav />

      {pendingDeleteRatingId ? (
        <div
          className="fixed inset-0 z-[140] bg-black/45 flex items-center justify-center px-4"
          onClick={() => setPendingDeleteRatingId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-rating-delete-title"
            className="w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="confirm-rating-delete-title" className="text-[17px] text-gray-900">
              Delete this rating?
            </h2>
            <p className="mt-1 text-[13px] text-gray-500 leading-relaxed">
              This action cannot be undone. Your rating and note will be removed from this place.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPendingDeleteRatingId(null)}
                className="h-10 rounded-xl border border-gray-200 bg-white text-[13px] text-gray-700"
              >
                No
              </button>
              <button
                type="button"
                disabled={deletingRatingId === pendingDeleteRatingId}
                onClick={async () => {
                  const confirmedId = pendingDeleteRatingId;
                  if (!confirmedId) return;
                  await handleDeleteRating(confirmedId);
                  setPendingDeleteRatingId(null);
                }}
                className="h-10 rounded-xl bg-red-600 text-[13px] text-white shadow-sm shadow-red-600/20 disabled:opacity-60"
              >
                {deletingRatingId === pendingDeleteRatingId ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
