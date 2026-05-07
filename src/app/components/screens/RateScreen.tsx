import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Check, MapPin, Search } from "lucide-react";
import { Sun, Moon, Coffee, Wine, Star } from "@phosphor-icons/react";
import { SLIDERS, VibeProfile } from "../vibe";
import { VibeSlider } from "../VibeSlider";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { useAuth } from "../../context/AuthContext";
import { usePlaces } from "../../context/PlacesContext";
import { PRICE_OPTIONS } from "../../context/FilterContext";
import { formatPubAddress } from "../placeAddress";
import type { VisitContext } from "@/types/place";
import { getUserRatingForPlace, upsertPlaceRating } from "@/lib/services/places";

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
  const [visit, setVisit] = useState<VisitContext | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasExistingRating, setHasExistingRating] = useState(false);

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
      setVisit(null);
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
          setVisit(null);
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
        setVisit(existing.visit_context ?? null);
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
    return (
      <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-emerald-600" />
        </div>
        <div className="text-gray-900 text-xl">Thanks for rating!</div>
        <div className="text-[13px] text-gray-600 mt-2 max-w-xs">
          Your rating for <span className="text-gray-900">{pub.name}</span> just contributed to its community place profile.
        </div>
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
    try {
      await upsertPlaceRating({
        place_id: pub.id,
        user_id: user.id,
        classic_modern: values.modern,
        quiet_lively: values.lively,
        cheap_premium: values.premium,
        local_touristy: values.touristy,
        cozy_spacious: values.spacious,
        price_range: price,
        visit_context: visit,
        note: note.trim() ? note.trim().slice(0, 160) : null,
      });
      await refresh();
      setSubmitted(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit rating.");
    } finally {
      setSubmitting(false);
    }
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

        {/* When did you visit — visual card grid */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">When did you visit?</div>
          <div className="grid grid-cols-2 gap-2">
            {VISIT_OPTIONS.slice(0, 4).map((opt) => {
              const selected = visit === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setVisit(opt.value as VisitContext)}
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
              const selected = visit === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setVisit(opt.value as VisitContext)}
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
