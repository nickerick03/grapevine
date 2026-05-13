import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronDown, MapPin, MessageSquareText, Star, Trophy } from "lucide-react";
import { getPublicProfileByUsername, type PublicProfileEntry } from "@/lib/services/profile";
import { getPublicProfileCupPlacements } from "@/lib/services/cups";
import { resolveCupArtworkUrl } from "@/lib/cup-artwork";
import type { PublicProfileCupPlacement } from "@/types/cup";
import { useAuth } from "@/app/context/AuthContext";
import { createUserProfileReport } from "@/lib/services/admin";
import { formatCupPeriod, getCupPlacementEmoji, getCupPlacementHeadline, getCupPlacementPointsLine } from "@/lib/cup-display";
import { CupDetailDialog } from "@/app/components/cups/CupDetailDialog";

const USER_REPORT_REASONS: Array<{
  value: "harassment" | "spam" | "impersonation" | "inappropriate" | "other";
  label: string;
}> = [
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "impersonation", label: "Impersonation" },
  { value: "inappropriate", label: "Inappropriate profile" },
  { value: "other", label: "Other" },
];

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
  const { user, openAuthModal } = useAuth();
  const { username = "" } = useParams<{ username: string }>();
  const [profile, setProfile] = useState<PublicProfileEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoreExpanded, setScoreExpanded] = useState(false);
  const [cupPlacements, setCupPlacements] = useState<PublicProfileCupPlacement[]>([]);
  const [placementsLoading, setPlacementsLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<"harassment" | "spam" | "impersonation" | "inappropriate" | "other">("harassment");
  const [reportMessage, setReportMessage] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportSuccess, setReportSuccess] = useState<string | null>(null);
  const [selectedCupPlacement, setSelectedCupPlacement] = useState<PublicProfileCupPlacement | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      try {
        const data = await getPublicProfileByUsername(decodeURIComponent(username));
        if (!cancelled) {
          setProfile(data);
        }
        if (data?.scoreVisible) {
          setPlacementsLoading(true);
          try {
            const placements = await getPublicProfileCupPlacements(data.username);
            if (!cancelled) {
              setCupPlacements(placements);
            }
          } catch {
            if (!cancelled) {
              setCupPlacements([]);
            }
          } finally {
            if (!cancelled) {
              setPlacementsLoading(false);
            }
          }
        } else if (!cancelled) {
          setCupPlacements([]);
          setPlacementsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setProfile(null);
          setCupPlacements([]);
          setPlacementsLoading(false);
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
    setCupPlacements([]);
    setPlacementsLoading(false);
    setSelectedCupPlacement(null);
  }, [username]);

  const handleName = useMemo(() => {
    const raw = profile?.username?.trim() || decodeURIComponent(username).trim().replace(/^@+/, "");
    return raw ? `@${raw}` : "Profile";
  }, [profile?.username, username]);
  const isOwnProfile = Boolean(user && profile && user.id === profile.userId);

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

    const baseLines = [
      { label: "Helpful votes received", value: profile.helpfulVotes ?? 0, weight: 0.1 },
      { label: "First ratings on unrated places", value: profile.firstRatings ?? 0, weight: 5 },
      { label: "Unique cities covered", value: profile.cityCount ?? 0, weight: 10 },
      { label: "Reviews submitted", value: profile.ratingCount ?? 0, weight: 1 },
      { label: "Notes submitted", value: profile.notesCount ?? 0, weight: 3 },
    ];

    const baseScore = baseLines.reduce((sum, line) => sum + line.value * line.weight, 0);
    const cupBonus = Math.max(0, Math.round(((profile.grapevineScore ?? 0) - baseScore) * 10) / 10);
    if (cupBonus > 0) {
      return [...baseLines, { label: "Cup placement rewards", value: cupBonus, weight: 1, directPoints: true }];
    }

    return baseLines;
  }, [
    profile?.cityCount,
    profile?.firstRatings,
    profile?.grapevineScore,
    profile?.helpfulVotes,
    profile?.notesCount,
    profile?.ratingCount,
    profile?.scoreVisible,
  ]);

  const openReportModal = () => {
    if (!user) {
      openAuthModal("login");
      return;
    }
    if (isOwnProfile) {
      return;
    }
    setReportError(null);
    setReportSuccess(null);
    setReportOpen(true);
  };

  const submitUserReport = async () => {
    if (!profile) return;
    if (!user) {
      openAuthModal("login");
      return;
    }
    if (user.id === profile.userId) {
      setReportError("You cannot report your own profile.");
      return;
    }

    setReportSubmitting(true);
    setReportError(null);
    try {
      const result = await createUserProfileReport(profile.userId, {
        reason: reportReason,
        message: reportMessage.trim() ? reportMessage.trim().slice(0, 280) : null,
      });
      if (result.status === "duplicate_blocked") {
        setReportSuccess("You already sent a similar report recently. Thanks, we’ve got it.");
      } else {
        setReportSuccess("Report submitted. Our moderation team will review it.");
      }
      setReportOpen(false);
      setReportMessage("");
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Could not submit report.");
    } finally {
      setReportSubmitting(false);
    }
  };

  useEffect(() => {
    if (!reportSuccess) {
      return;
    }
    const timeout = window.setTimeout(() => setReportSuccess(null), 3000);
    return () => window.clearTimeout(timeout);
  }, [reportSuccess]);

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
                    {!isOwnProfile ? (
                      <button
                        type="button"
                        onClick={openReportModal}
                        className="mt-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] text-rose-700 hover:bg-rose-100"
                      >
                        Report user
                      </button>
                    ) : null}
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
                                {"directPoints" in line && line.directPoints
                                  ? line.label
                                  : `${line.label} (${line.value}) × ${line.weight}`}
                              </span>
                              <span className="text-gray-700">
                                +{formatScore(("directPoints" in line && line.directPoints) ? line.value : line.value * line.weight)}
                              </span>
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
                <Trophy className="w-4 h-4 text-amber-500" />
                <span className="text-[14px]">Cup Honors</span>
              </div>

              {!profile.scoreVisible ? (
                <div className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-[12px] text-gray-600">
                  Cup honors are hidden by this user's score privacy setting.
                </div>
              ) : placementsLoading ? (
                <div className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-[12px] text-gray-500">
                  Loading Cup honors...
                </div>
              ) : cupPlacements.length === 0 ? (
                <div className="rounded-2xl bg-gray-50 border border-gray-100 px-3 py-2.5 text-[12px] text-gray-600">
                  No Cup wins yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {cupPlacements.map((placement) => {
                    const placementArtworkUri = placement.placement === 1
                      ? resolveCupArtworkUrl({ artworkUrl: placement.cupArtworkUrl, svgMarkup: null })
                      : resolveCupArtworkUrl({ artworkUrl: null, svgMarkup: placement.badgeSvgMarkup })
                        ?? resolveCupArtworkUrl({ artworkUrl: placement.cupArtworkUrl, svgMarkup: null });
                    return (
                      <button
                        key={`${placement.cupId}:${placement.placement}`}
                        type="button"
                        onClick={() => setSelectedCupPlacement(placement)}
                        className="w-full text-left rounded-2xl border border-gray-100 bg-gray-50 p-3 flex items-center gap-3 hover:border-gray-200 transition-colors"
                      >
                        <div className="w-12 h-12 rounded-xl border border-gray-100 bg-white flex items-center justify-center overflow-hidden">
                          {placementArtworkUri ? (
                            <img src={placementArtworkUri} alt={`${placement.cupName} placement`} className="w-full h-full object-contain" />
                          ) : (
                            <span className="text-xl">{getCupPlacementEmoji(placement.placement)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-[13px] text-gray-900 truncate">{getCupPlacementHeadline(placement)}</div>
                          <div className="text-[11px] text-gray-600">{getCupPlacementPointsLine(placement)}</div>
                          <div className="text-[10px] text-gray-400">
                            {formatCupPeriod(placement.cupStartAt, placement.cupEndAt, placement.awardedAt)}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
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
      <CupDetailDialog
        open={Boolean(selectedCupPlacement)}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCupPlacement(null);
          }
        }}
        cup={
          selectedCupPlacement
            ? {
                name: selectedCupPlacement.cupName,
                description: selectedCupPlacement.cupDescription,
                artworkUrl: selectedCupPlacement.cupArtworkUrl,
                startAt: selectedCupPlacement.cupStartAt,
                endAt: selectedCupPlacement.cupEndAt,
                rewardPoints: selectedCupPlacement.cupRewardPoints,
                placement: selectedCupPlacement.placement,
                cupScore: selectedCupPlacement.cupScore,
                rewardPointsAwarded: selectedCupPlacement.rewardPointsAwarded,
                awardedAt: selectedCupPlacement.awardedAt,
                badgeSvgMarkup: selectedCupPlacement.badgeSvgMarkup,
              }
            : null
        }
      />
      {reportOpen ? (
        <div className="fixed inset-0 z-[110] bg-black/40 flex items-center justify-center px-4" onClick={() => setReportOpen(false)}>
          <div
            className="w-full max-w-sm rounded-3xl bg-white border border-gray-200 shadow-[0_18px_52px_rgba(0,0,0,.2)] p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="text-[15px] text-gray-900">Report @{profile?.username ?? "user"}</div>
            <div className="text-[12px] text-gray-500 mt-1">Tell us why this profile should be reviewed.</div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {USER_REPORT_REASONS.map((reason) => {
                const active = reason.value === reportReason;
                return (
                  <button
                    key={reason.value}
                    type="button"
                    onClick={() => setReportReason(reason.value)}
                    className={`rounded-xl border px-2 py-1.5 text-[12px] ${
                      active ? "border-gray-900 bg-gray-900 text-white" : "border-gray-200 bg-white text-gray-700"
                    }`}
                  >
                    {reason.label}
                  </button>
                );
              })}
            </div>
            <textarea
              value={reportMessage}
              onChange={(event) => setReportMessage(event.target.value.slice(0, 280))}
              placeholder="Optional note for moderators"
              rows={3}
              className="mt-3 w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] outline-none focus:border-gray-400"
            />
            {reportError ? <div className="mt-2 text-[12px] text-rose-600">{reportError}</div> : null}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setReportOpen(false)} className="flex-1 rounded-xl border border-gray-200 py-2 text-[12px] text-gray-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitUserReport()}
                disabled={reportSubmitting}
                className="flex-1 rounded-xl bg-rose-600 py-2 text-[12px] text-white disabled:opacity-60"
              >
                {reportSubmitting ? "Submitting..." : "Submit report"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {reportSuccess ? (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[120] rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-[12px] text-emerald-700">
          {reportSuccess}
        </div>
      ) : null}
    </div>
  );
}
