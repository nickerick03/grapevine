import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, MapPin, Search } from "lucide-react";
import { Sun, Moon, Coffee, Wine, Star } from "@phosphor-icons/react";
import confetti from "canvas-confetti";
import { SLIDERS, VibeProfile } from "../vibe";
import { VibeSlider } from "../VibeSlider";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { useAuth } from "../../context/AuthContext";
import { usePlaces } from "../../context/PlacesContext";
import { PRICE_OPTIONS } from "../../context/FilterContext";
import { formatPubAddress } from "../placeAddress";
import { normalizeVisitContexts, type VisitContext } from "@/types/place";
import { getUserRatingForPlace, upsertPlaceRating } from "@/lib/services/places";
import { getGrapevineScoreByUserId, getLeaderboard, type GrapevineScoreBreakdown } from "@/lib/services/profile";

const VISIT_OPTIONS = [
  {
    value: "Weekday afternoon",
    time: "Afternoon",
    day: "Weekday",
    Icon: Sun,
    color: "#F59E0B",
    bg: "#FEF3C7",
    border: "#FDE68A",
  },
  {
    value: "Weekday evening",
    time: "Evening",
    day: "Weekday",
    Icon: Coffee,
    color: "#8B5CF6",
    bg: "#EDE9FE",
    border: "#DDD6FE",
  },
  {
    value: "Weekend afternoon",
    time: "Afternoon",
    day: "Weekend",
    Icon: Star,
    color: "#10B981",
    bg: "#D1FAE5",
    border: "#A7F3D0",
  },
  {
    value: "Weekend evening",
    time: "Evening",
    day: "Weekend",
    Icon: Wine,
    color: "#EF4444",
    bg: "#FEE2E2",
    border: "#FECACA",
  },
  {
    value: "Late night",
    time: "Late night",
    day: "",
    Icon: Moon,
    color: "#374151",
    bg: "#F3F4F6",
    border: "#E5E7EB",
  },
] as const;

const CONFETTI_COLORS = ["#F59E0B", "#EF4444", "#10B981", "#3B82F6", "#8B5CF6", "#F97316"];

function formatPoints(value: number): string {
  const rounded = Number(value.toFixed(1));
  return Number.isInteger(rounded) ? `${rounded}` : `${rounded.toFixed(1)}`;
}

export function RateScreen() {
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();
  const { pubs, refresh } = usePlaces();
  const { id } = useParams<{ id: string }>();
  const [selectedPubId, setSelectedPubId] = useState<string | null>(id ?? null);
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);
  const [values, setValues] = useState<VibeProfile>({ modern: 50, lively: 50, premium: 50, touristy: 50, spacious: 50 });
  const [price, setPrice] = useState<1 | 2 | 3 | 4 | null>(null);
  const [visits, setVisits] = useState<VisitContext[]>([]);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExistingRating, setHasExistingRating] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState<number | null>(null);
  const [rankBefore, setRankBefore] = useState<number | null>(null);
  const [rankAfter, setRankAfter] = useState<number | null>(null);
  const [rankPreviewLoading, setRankPreviewLoading] = useState(false);
  const [scorePulse, setScorePulse] = useState(false);
  const [animatedEarnedPoints, setAnimatedEarnedPoints] = useState(0);
  const [earnedBreakdownLines, setEarnedBreakdownLines] = useState<string[]>([]);
  const confettiPlayedRef = useRef(false);

  useEffect(() => {
    if (!submitted || confettiPlayedRef.current) {
      return;
    }

    confettiPlayedRef.current = true;

    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const fire = (particleCount: number, spread: number, velocity: number, drift: number) => {
      confetti({
        particleCount,
        spread,
        startVelocity: velocity,
        gravity: 1.15,
        decay: 0.93,
        scalar: 0.95,
        drift,
        ticks: 300,
        origin: { x: 0.5, y: 1.03 },
        colors: CONFETTI_COLORS,
      });
    };

    fire(52, 72, 72, -0.1);
    window.setTimeout(() => fire(38, 95, 60, 0.12), 110);
    window.setTimeout(() => fire(24, 112, 50, -0.04), 220);
  }, [submitted]);

  useEffect(() => {
    if (!submitted || earnedPoints == null || earnedPoints <= 0) {
      setAnimatedEarnedPoints(0);
      return;
    }

    let rafId = 0;
    const durationMs = 1300;
    const start = performance.now();
    const target = earnedPoints;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setAnimatedEarnedPoints(target * eased);
      if (t < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [earnedPoints, submitted]);

  useEffect(() => {
    if (id) {
      setSelectedPubId(id);
    } else if (!selectedPubId && pubs.length > 0) {
      setSelectedPubId(pubs[0].id);
    }
  }, [id, pubs, selectedPubId]);

  const pub = useMemo(
    () => (selectedPubId ? pubs.find((p) => p.id === selectedPubId) ?? null : null),
    [pubs, selectedPubId],
  );

  useEffect(() => {
    if (!user || !pub) {
      setValues({ modern: 50, lively: 50, premium: 50, touristy: 50, spacious: 50 });
      setPrice(null);
      setVisits([]);
      setNote("");
      setHasExistingRating(false);
      return;
    }
    const userId = user.id;
    const currentPubId = pub.id;

    let cancelled = false;

    async function loadExistingRating() {
      try {
        const existing = await getUserRatingForPlace(currentPubId, userId);
        if (cancelled) {
          return;
        }

        if (!existing) {
          setValues({ modern: 50, lively: 50, premium: 50, touristy: 50, spacious: 50 });
          setPrice(null);
          setVisits([]);
          setNote("");
          setHasExistingRating(false);
          return;
        }

        setValues({
          modern: existing.classic_modern,
          lively: existing.quiet_lively,
          premium: existing.cheap_premium,
          touristy: existing.local_touristy,
          spacious: existing.cozy_spacious,
        });
        setPrice(existing.price_range ?? null);
        setVisits(normalizeVisitContexts(existing.visit_contexts ?? existing.visit_context ?? null));
        setNote(existing.note ?? "");
        setHasExistingRating(true);
      } catch {
        if (!cancelled) {
          setHasExistingRating(false);
        }
      }
    }

    loadExistingRating();
    return () => {
      cancelled = true;
    };
  }, [pub, user]);

  if (!user) {
    return (
      <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-gray-900 text-xl">Log in to rate places</div>
        <div className="text-[13px] text-gray-600 mt-2 max-w-xs">
          Ratings are linked to your account so you can update them later.
        </div>
        <button
          onClick={() => {
            navigate(-1 as any);
            openAuthModal();
          }}
          className="mt-6 w-full max-w-sm py-3 rounded-2xl bg-gray-900 text-white"
        >
          Log in
        </button>
      </div>
    );
  }

  if (!pub) {
    return (
      <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col items-center justify-center px-6 text-center">
        <div className="text-gray-900 text-xl">No places available</div>
      </div>
    );
  }

  if (submitted) {
    const hasRankPreview = rankBefore != null && rankAfter != null;
    const rankImproved = hasRankPreview && rankAfter < rankBefore;
    const rankChanged = hasRankPreview && rankAfter !== rankBefore;
    const resolvedEarnedPoints = earnedPoints ?? 0;

    return (
      <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col items-center justify-center px-6 text-center overflow-hidden">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <div className="text-gray-900 text-xl">Thanks for rating!</div>
        <div className="text-[13px] text-gray-600 mt-2 max-w-xs">
          Your rating for <span className="text-gray-900">{pub.name}</span> just contributed to its community place profile.
        </div>
        {resolvedEarnedPoints > 0 ? (
          <div className="mt-4 w-full max-w-sm rounded-2xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 text-left">
            <div>
              <div
                className={`mt-1 text-[22px] leading-none font-semibold text-emerald-700 transition-transform duration-300 ${
                  scorePulse ? "scale-110" : "scale-100"
                }`}
              >
                +{formatPoints(animatedEarnedPoints)} pts
              </div>
            </div>
            <div className="mt-1.5 space-y-1">
              {earnedBreakdownLines.map((line) => (
                <div key={line} className="text-[11px] text-emerald-700/90">
                  {line}
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {rankPreviewLoading ? (
          <div className="mt-3 w-full max-w-sm rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left">
            <div className="text-[11px] text-gray-500">Checking leaderboard update…</div>
          </div>
        ) : hasRankPreview ? (
          <div className="mt-3 w-full max-w-sm rounded-2xl border border-gray-100 bg-white px-4 py-3 text-left">
            <div className="text-[11px] text-gray-500 uppercase tracking-wide">Congratulations!</div>
            <div className="mt-1 text-[14px] text-gray-900">
              {rankImproved
                ? `You moved up from #${rankBefore} to #${rankAfter}.`
                : rankChanged
                  ? `You are now ranked #${rankAfter} (was #${rankBefore}).`
                  : `You are currently ranked #${rankAfter}.`}
            </div>
          </div>
        ) : null}
        <div className="mt-6 p-4 rounded-2xl bg-white border border-gray-100 w-full max-w-sm">
          <div className="text-[12px] text-gray-500 mb-2">Your contribution</div>
          <div className="space-y-1.5">
            {SLIDERS.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full" style={{ width: `${values[s.key]}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex gap-2 mt-6 w-full max-w-sm">
          <button onClick={() => navigate(`/detail/${pub.id}`)} className="flex-1 py-3 rounded-2xl bg-white border border-gray-200">
            View pub
          </button>
          <button onClick={() => navigate("/")} className="flex-1 py-3 rounded-2xl bg-gray-900 text-white">
            Done
          </button>
        </div>
      </div>
    );
  }

  const matches = pubs.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const handleSubmit = async () => {
    if (!user) {
      openAuthModal();
      return;
    }

    setSubmitting(true);
    setError(null);
    setRankPreviewLoading(true);
    setEarnedPoints(null);
    setAnimatedEarnedPoints(0);
    setEarnedBreakdownLines([]);
    setRankBefore(null);
    setRankAfter(null);
    try {
      let beforeScore = 0;
      let beforeRank: number | null = null;
      let beforeBreakdown: GrapevineScoreBreakdown | null = null;

      try {
        const [scoreBeforeData, leaderboardBefore] = await Promise.all([
          getGrapevineScoreByUserId(user.id),
          getLeaderboard(250),
        ]);
        beforeBreakdown = scoreBeforeData;
        beforeScore = scoreBeforeData.grapevineScore;
        beforeRank = leaderboardBefore.find((entry) => entry.userId === user.id)?.rank ?? null;
      } catch {
        beforeScore = 0;
        beforeRank = null;
        beforeBreakdown = null;
      }

      await upsertPlaceRating({
        place_id: pub.id,
        user_id: user.id,
        classic_modern: values.modern,
        quiet_lively: values.lively,
        cheap_premium: values.premium,
        local_touristy: values.touristy,
        cozy_spacious: values.spacious,
        price_range: price,
        visit_contexts: visits.length > 0 ? visits : null,
        visit_context: visits[0] ?? null,
        note: note.trim() ? note.trim().slice(0, 160) : null,
      });
      await refresh();

      let afterScore = beforeScore;
      let afterRank: number | null = null;
      let afterBreakdown: GrapevineScoreBreakdown | null = null;
      try {
        const [scoreAfterData, leaderboardAfter] = await Promise.all([
          getGrapevineScoreByUserId(user.id),
          getLeaderboard(250),
        ]);
        afterBreakdown = scoreAfterData;
        afterScore = scoreAfterData.grapevineScore;
        afterRank = leaderboardAfter.find((entry) => entry.userId === user.id)?.rank ?? null;
      } catch {
        afterScore = beforeScore;
        afterRank = null;
        afterBreakdown = null;
      }

      const delta = Math.max(0, Number((afterScore - beforeScore).toFixed(1)));
      setEarnedPoints(delta);
      if (beforeBreakdown && afterBreakdown && delta > 0) {
        const helpfulVotesDelta = Math.max(0, afterBreakdown.helpfulVotesReceived - beforeBreakdown.helpfulVotesReceived);
        const firstRatingsDelta = Math.max(0, afterBreakdown.firstRatingsSubmitted - beforeBreakdown.firstRatingsSubmitted);
        const uniqueCitiesDelta = Math.max(0, afterBreakdown.uniqueCitiesCovered - beforeBreakdown.uniqueCitiesCovered);
        const reviewsDelta = Math.max(0, afterBreakdown.reviewsSubmitted - beforeBreakdown.reviewsSubmitted);
        const notesDelta = Math.max(0, afterBreakdown.notesSubmitted - beforeBreakdown.notesSubmitted);

        const lines: string[] = [];
        if (reviewsDelta > 0) lines.push(`+${formatPoints(reviewsDelta * 1)} from review submitted`);
        if (notesDelta > 0) lines.push(`+${formatPoints(notesDelta * 3)} from note submitted`);
        if (firstRatingsDelta > 0) lines.push(`+${formatPoints(firstRatingsDelta * 5)} from first rating on a new place`);
        if (uniqueCitiesDelta > 0) lines.push(`+${formatPoints(uniqueCitiesDelta * 10)} from unique city coverage`);
        if (helpfulVotesDelta > 0) lines.push(`+${formatPoints(helpfulVotesDelta * 0.1)} from helpful votes`);
        setEarnedBreakdownLines(lines);
      } else {
        setEarnedBreakdownLines([]);
      }
      setRankBefore(beforeRank);
      setRankAfter(afterRank);
      setSubmitted(true);
      setScorePulse(true);
      window.setTimeout(() => setScorePulse(false), 420);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit rating.");
    } finally {
      setSubmitting(false);
      setRankPreviewLoading(false);
    }
  };

  const toggleVisit = (context: VisitContext) => {
    setVisits((current) => (
      current.includes(context)
        ? current.filter((item) => item !== context)
        : [...current, context]
    ));
  };

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 border-b border-gray-100 bg-white/70 backdrop-blur">
        <button
          onClick={() => navigate(-1 as any)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="text-gray-900 text-[16px]">Rate this place</div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(9rem+env(safe-area-inset-bottom))] space-y-5">

        {/* Pub selector */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Pub</div>
          {!picking ? (
            <button
              onClick={() => setPicking(true)}
              className="w-full rounded-2xl bg-white border border-gray-200 overflow-hidden text-left"
            >
              {/* Image above title */}
              <div className="relative h-32">
                <ImageWithFallback
                  src={pub.image}
                  alt={pub.name}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                <div className="absolute bottom-2 right-2 text-[11px] text-white bg-black/30 backdrop-blur-sm px-2.5 py-0.5 rounded-full border border-white/20">
                  Change
                </div>
              </div>
              <div className="p-3">
                <div className="text-gray-900">{pub.name}</div>
                <div className="text-[12px] text-gray-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate">{formatPubAddress(pub)}</span>
                </div>
              </div>
            </button>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-200 p-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search the pub"
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 outline-none text-[13px]"
                />
              </div>
              <div className="mt-2 max-h-48 overflow-y-auto">
                {matches.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => { setSelectedPubId(p.id); setPicking(false); }}
                    className="w-full text-left p-2 rounded-xl hover:bg-gray-50 text-[13px] flex items-center gap-2"
                  >
                    <ImageWithFallback src={p.image} alt={p.name} className="w-9 h-9 rounded-lg object-cover flex-none" />
                    <div>
                      <div className="text-gray-900">{p.name}</div>
                      <div className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate">{formatPubAddress(p)}</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Trait sliders */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">How did it feel?</div>
          <div className="space-y-2">
            {SLIDERS.map((s) => (
              <VibeSlider
                key={s.key}
                def={s}
                value={values[s.key]}
                onChange={(v) => setValues((prev) => ({ ...prev, [s.key]: v }))}
              />
            ))}
          </div>
        </div>

        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Price range</div>
          <div className="grid grid-cols-4 gap-2">
            {PRICE_OPTIONS.map((opt) => {
              const active = price === opt.value;
              return (
                <button
                  key={opt.label}
                  onClick={() => setPrice(active ? null : opt.value)}
                  className={`py-2 rounded-xl text-[13px] border transition-colors ${
                    active
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 active:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* When did you visit — multi-select card grid */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">When did you visit?</div>
          <div className="mb-2 text-[12px] text-gray-500">
            Select all that apply.
          </div>
          <div className="grid grid-cols-2 gap-2">
            {VISIT_OPTIONS.slice(0, 4).map((opt) => {
              const selected = visits.includes(opt.value as VisitContext);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleVisit(opt.value as VisitContext)}
                  className="rounded-2xl p-3 flex flex-col items-start gap-2 border transition-all text-left"
                  style={
                    selected
                      ? { background: opt.bg, borderColor: opt.border, borderWidth: 1.5 }
                      : { background: "#ffffff", borderColor: "#f3f4f6", borderWidth: 1 }
                  }
                >
                  <opt.Icon
                    weight="duotone"
                    size={26}
                    style={{ color: selected ? opt.color : "#9ca3af" }}
                  />
                  <div>
                    <div
                      className="text-[13px] leading-tight"
                      style={{ color: selected ? opt.color : "#111827" }}
                    >
                      {opt.time}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">{opt.day}</div>
                  </div>
                </button>
              );
            })}
            {/* Late night — full width */}
            {(() => {
              const opt = VISIT_OPTIONS[4];
              const selected = visits.includes(opt.value as VisitContext);
              return (
                <button
                  key={opt.value}
                  onClick={() => toggleVisit(opt.value as VisitContext)}
                  className="col-span-2 rounded-2xl px-4 py-3 flex items-center gap-3 border transition-all"
                  style={
                    selected
                      ? { background: opt.bg, borderColor: opt.border, borderWidth: 1.5 }
                      : { background: "#ffffff", borderColor: "#f3f4f6", borderWidth: 1 }
                  }
                >
                  <opt.Icon
                    weight="duotone"
                    size={26}
                    style={{ color: selected ? opt.color : "#9ca3af" }}
                  />
                  <div
                    className="text-[13px]"
                    style={{ color: selected ? opt.color : "#111827" }}
                  >
                    {opt.time}
                  </div>
                </button>
              );
            })()}
          </div>
          {visits.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visits.map((context) => (
                <span
                  key={context}
                  className="px-2 py-1 rounded-full text-[11px] bg-gray-100 text-gray-700 border border-gray-200"
                >
                  {context}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Quick note */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] text-gray-500 uppercase tracking-wide">Quick note (optional)</div>
            <div className="text-[11px] text-gray-400">{note.length}/160</div>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 160))}
            placeholder="What stood out?"
            className="w-full p-3 rounded-2xl bg-white border border-gray-200 text-[13px] outline-none focus:border-gray-300 resize-none h-20"
          />
        </div>
      </div>

      <div className="flex-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] border-t border-gray-100 bg-white/90 backdrop-blur">
        <button
          onClick={handleSubmit}
          disabled={submitting}
          className="w-full py-3.5 rounded-2xl bg-gray-900 text-white shadow-md disabled:opacity-70"
        >
          {submitting ? "Saving..." : hasExistingRating ? "Update rating" : "Submit rating"}
        </button>
        {error ? <p className="mt-2 text-[12px] text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}
