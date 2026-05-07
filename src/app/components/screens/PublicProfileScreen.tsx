import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronDown, MapPin, MessageSquareText, Star, Trophy } from "lucide-react";
import { getPublicProfileByUsername, type PublicProfileEntry } from "@/lib/services/profile";

function formatMemberSince(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
  });
}

function formatNoteDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatScore(value: number | null): string {
  if (value == null || !Number.isFinite(value)) {
    return "0";
  }

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export function PublicProfileScreen() {
  const navigate = useNavigate();
  const { username = "" } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfileEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoreExpanded, setScoreExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      try {
        const data = await getPublicProfileByUsername(decodeURIComponent(username));
        if (!cancelled) {
          setProfile(data);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, [username]);

  useEffect(() => {
    setScoreExpanded(false);
  }, [username]);

  const handleName = useMemo(() => {
    const raw = profile?.username?.trim() || decodeURIComponent(username).trim().replace(/^@+/, "");
    return raw ? `@${raw}` : "Profile";
  }, [profile?.username, username]);

  const podiumTier = useMemo<"gold" | "silver" | "bronze" | null>(() => {
    if (!profile?.scoreVisible) {
      return null;
    }
    if (profile.leaderboardRank === 1) {
      return "gold";
    }
    if (profile.leaderboardRank === 2) {
      return "silver";
    }
    if (profile.leaderboardRank === 3) {
      return "bronze";
    }
    return null;
  }, [profile?.leaderboardRank, profile?.scoreVisible]);

  const scoreLines = useMemo(() => {
    if (!profile?.scoreVisible) {
      return [];
    }

    return [
      { label: "Helpful votes received", value: profile.helpfulVotes ?? 0, weight: 0.1 },
      { label: "First ratings on unrated places", value: profile.firstRatings ?? 0, weight: 5 },
      { label: "Unique cities covered", value: profile.cityCount ?? 0, weight: 10 },
      { label: "Reviews submitted", value: profile.ratingCount ?? 0, weight: 1 },
      { label: "Notes submitted", value: profile.notesCount ?? 0, weight: 3 },
    ];
  }, [
    profile?.cityCount,
    profile?.firstRatings,
    profile?.helpfulVotes,
    profile?.notesCount,
    profile?.ratingCount,
    profile?.scoreVisible,
  ]);

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      <div className="flex-none flex items-center justify-between px-4 pt-3 pb-2 bg-white/70 backdrop-blur border-b border-gray-100 z-10">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
          aria-label="Go back"
        >
          <ArrowLeft className="w-4 h-4 text-gray-700" />
        </button>
        <div className="text-gray-900 text-[16px]">Profile</div>
        <div className="w-9" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pt-6 pb-[96px]">
        {loading ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-5">
            <div className="h-5 w-24 rounded bg-gray-100 animate-pulse" />
            <div className="h-16 w-16 rounded-2xl bg-gray-100 animate-pulse mt-4" />
            <div className="h-4 w-40 rounded bg-gray-100 animate-pulse mt-4" />
          </div>
        ) : !profile ? (
          <div className="bg-white rounded-3xl border border-gray-100 p-5 text-center">
            <div className="text-gray-900 text-[15px]">Profile not found</div>
            <div className="text-[13px] text-gray-500 mt-1">This user may have changed their username.</div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className={podiumTier ? `leaderboard-profile-frame leaderboard-profile-frame-${podiumTier}` : ""}>
              <div
                className={`bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.05)] p-5 ${
                  podiumTier ? "leaderboard-profile-card" : ""
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <div
                    className="w-20 h-20 rounded-2xl overflow-hidden flex items-center justify-center text-white text-2xl shadow-lg flex-none"
                    style={{ background: `linear-gradient(135deg, ${profile.gradientFrom}, ${profile.gradientTo})` }}
                  >
                    {profile.avatarUrl ? (
                      <img src={profile.avatarUrl} alt={profile.username} className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      profile.emoji
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="text-gray-900 text-[18px]">{handleName}</div>
                    {profile.city ? (
                      <div className="mt-1 flex items-center gap-1 text-[13px] text-gray-500">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate">{profile.city}</span>
                      </div>
                    ) : null}
                    <div className="mt-1 text-[12px] text-gray-400">Member since {formatMemberSince(profile.createdAt)}</div>
                  </div>
                </div>

                {profile.scoreVisible ? (
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-2xl border border-gray-100 p-3 text-center bg-gray-50">
                        <div className="flex items-center justify-center gap-1 text-gray-900">
                          <Star className="w-4 h-4 text-amber-500" />
                          <span>{formatScore(profile.grapevineScore)}</span>
                        </div>
                        <div className="text-[11px] text-gray-500 mt-0.5">Grapevine Score</div>
                      </div>
                      <div className="rounded-2xl border border-gray-100 p-3 text-center bg-gray-50">
                        <div className="text-gray-900">{profile.ratingCount ?? 0}</div>
                        <div className="text-[11px] text-gray-500 mt-0.5">
                          {profile.cityCount ?? 0} {profile.cityCount === 1 ? "city" : "cities"}
                        </div>
                      </div>
                      <div
                        className={`rounded-2xl border border-gray-100 p-3 text-center bg-gray-50 ${
                          podiumTier ? `leaderboard-rank-card leaderboard-rank-card-${podiumTier}` : ""
                        }`}
                      >
                        <div className={`flex items-center justify-center gap-1 ${podiumTier ? "text-white" : "text-gray-900"}`}>
                          <Trophy className={`w-4 h-4 ${podiumTier ? "text-white" : "text-emerald-500"}`} />
                          <span>{profile.leaderboardRank ? `#${profile.leaderboardRank}` : "—"}</span>
                        </div>
                        <div className={`text-[11px] mt-0.5 ${podiumTier ? "text-white/90" : "text-gray-500"}`}>Leaderboard</div>
                      </div>
                    </div>

                    <div className="mt-3 rounded-2xl border border-gray-100 bg-gray-50 p-3">
                      <button
                        onClick={() => setScoreExpanded((previous) => !previous)}
                        className="w-full flex items-center justify-between"
                        aria-expanded={scoreExpanded}
                      >
                        <div className="text-[12px] text-gray-700">Grapevine Score</div>
                        <div className="flex items-center gap-1.5 text-gray-900">
                          <span className="text-[16px]">{formatScore(profile.grapevineScore)}</span>
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-gray-500 transition-transform ${scoreExpanded ? "rotate-180" : ""}`}
                          />
                        </div>
                      </button>
                      {scoreExpanded ? (
                        <div className="mt-2 space-y-1">
                          {scoreLines.map((line) => (
                            <div key={line.label} className="flex items-center justify-between text-[11px] text-gray-600">
                              <span className="truncate pr-2">
                                {line.label} ({line.value}) × {line.weight}
                              </span>
                              <span className="text-gray-700">+{formatScore(line.value * line.weight)}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 pt-4 border-t border-gray-100 rounded-2xl bg-gray-50 border px-3 py-2.5 text-[12px] text-gray-600">
                    This user keeps contribution stats private.
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.05)] p-4">
              <div className="flex items-center gap-2 text-gray-900 mb-2">
                <MessageSquareText className="w-4 h-4 text-blue-500" />
                <span className="text-[14px]">Notes</span>
              </div>

              {!profile.notesPublic ? (
                <div className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-[12px] text-gray-600">
                  This user keeps notes private.
                </div>
              ) : profile.notes.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-[12px] text-gray-600">
                  No public notes yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {profile.notes.map((entry) => (
                    <button
                      key={entry.ratingId}
                      onClick={() => navigate(`/detail/${entry.placeId}`)}
                      className="w-full text-left rounded-2xl border border-gray-100 bg-gray-50 p-3 hover:border-gray-200 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[13px] text-gray-900 truncate">{entry.placeName}</div>
                        <div className="text-[11px] text-gray-500 whitespace-nowrap">{formatNoteDate(entry.notedAt)}</div>
                      </div>
                      {entry.placeCity ? <div className="text-[11px] text-gray-500 mt-0.5">{entry.placeCity}</div> : null}
                      <div className="text-[13px] text-gray-700 mt-1">{entry.note}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
