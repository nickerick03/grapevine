import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Search, Check, X, MapPin } from "lucide-react";
import { Sun, Moon, Coffee, Wine, Star } from "@phosphor-icons/react";
import { SLIDERS, VibeProfile, type Pub } from "./vibe";
import { VibeSlider } from "./VibeSlider";
import { VenueImage } from "./VenueImage";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { usePlaces } from "../context/PlacesContext";
import { PRICE_OPTIONS } from "../context/FilterContext";
import { formatPubAddress } from "./placeAddress";
import type { VisitContext } from "@/types/place";
import {
  getPlaceByExternalSource,
  getUserRatingForPlace,
  upsertExternalPlaceFirstRating,
  upsertPlaceRating,
} from "@/lib/services/places";

const DEFAULT_VALUES: VibeProfile = { modern: 50, lively: 50, premium: 50, touristy: 50, spacious: 50 };

const VISIT_OPTIONS = [
  { value: "Weekday afternoon", time: "Afternoon", day: "Weekday", Icon: Sun,   color: "#F59E0B", bg: "#FEF3C7", border: "#FDE68A" },
  { value: "Weekday evening",   time: "Evening",   day: "Weekday", Icon: Coffee, color: "#8B5CF6", bg: "#EDE9FE", border: "#DDD6FE" },
  { value: "Weekend afternoon", time: "Afternoon", day: "Weekend", Icon: Star,   color: "#10B981", bg: "#D1FAE5", border: "#A7F3D0" },
  { value: "Weekend evening",   time: "Evening",   day: "Weekend", Icon: Wine,   color: "#EF4444", bg: "#FEE2E2", border: "#FECACA" },
  { value: "Late night",        time: "Late night",day: "",        Icon: Moon,   color: "#374151", bg: "#F3F4F6", border: "#E5E7EB" },
] as const;

export function RateModal() {
  const { rateOpen, ratePubId, rateExternalPlace, closeRate } = useUI();
  const { user, openAuthModal } = useAuth();
  const { pubs, refresh } = usePlaces();

  const externalFallbackPub: Pub | null = useMemo(
    () =>
      rateExternalPlace
        ? {
            id: `osm:${rateExternalPlace.sourcePlaceId}`,
            sourceProvider: "osm",
            sourcePlaceId: rateExternalPlace.sourcePlaceId,
            isExternalCandidate: true,
            name: rateExternalPlace.name,
            category: rateExternalPlace.category,
            venueType: rateExternalPlace.venueType,
            priceRange: null,
            address: rateExternalPlace.address,
            country: rateExternalPlace.country,
            area: rateExternalPlace.address,
            city: rateExternalPlace.city,
            summary: "No ratings yet. Be the first to add a rating.",
            chips: [],
            match: 0,
            ratings: 0,
            vibe: {
              modern: 50,
              lively: 50,
              premium: 50,
              touristy: 50,
              spacious: 50,
            },
            image: rateExternalPlace.imageUrl ?? "",
            openingHours: rateExternalPlace.openingHours ?? null,
            phone: rateExternalPlace.phone ?? null,
            email: rateExternalPlace.email ?? null,
            website: rateExternalPlace.website ?? null,
            lat: rateExternalPlace.latitude,
            lng: rateExternalPlace.longitude,
          }
        : null,
    [rateExternalPlace],
  );
  const currentTargetKey = rateExternalPlace?.sourcePlaceId
    ? `osm:${rateExternalPlace.sourcePlaceId}`
    : (ratePubId ?? "default");
  const initialPub = useMemo(
    () => pubs.find((p) => p.id === ratePubId) ?? externalFallbackPub ?? pubs[0] ?? null,
    [externalFallbackPub, pubs, ratePubId],
  );

  const [pub, setPub] = useState<Pub | null>(initialPub);
  const [search, setSearch] = useState("");
  const [picking, setPicking] = useState(false);
  const [values, setValues] = useState<VibeProfile>(DEFAULT_VALUES);
  const [price, setPrice] = useState<1 | 2 | 3 | 4 | null>(null);
  const [visit, setVisit] = useState<VisitContext | null>(null);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hasExistingRating, setHasExistingRating] = useState(false);
  const initializedTargetRef = useRef<string | null>(null);

  // Initialize form only once per modal open/target. This prevents slider resets during interaction.
  useEffect(() => {
    if (!rateOpen) {
      initializedTargetRef.current = null;
      return;
    }
    if (initializedTargetRef.current === currentTargetKey && pub) {
      return;
    }

    setPub(initialPub);
    setSearch("");
    setPicking(false);
    setValues(DEFAULT_VALUES);
    setPrice(null);
    setVisit(null);
    setNote("");
    setSubmitted(false);
    setSubmitError(null);
    setSaving(false);
    setHasExistingRating(false);
    initializedTargetRef.current = currentTargetKey;
  }, [currentTargetKey, initialPub, pub, rateOpen]);

  useEffect(() => {
    if (!rateOpen || !pub || !user) {
      return;
    }
    const userId = user.id;
    const currentPub = pub;

    let cancelled = false;

    async function loadExistingRating() {
      try {
        let targetPlaceId = currentPub.id;
        if (currentPub.isExternalCandidate && currentPub.sourceProvider === "osm" && currentPub.sourcePlaceId) {
          const linkedPlace = await getPlaceByExternalSource("osm", currentPub.sourcePlaceId);
          if (!linkedPlace) {
            setValues(DEFAULT_VALUES);
            setPrice(null);
            setVisit(null);
            setNote("");
            setHasExistingRating(false);
            return;
          }
          targetPlaceId = linkedPlace.id;
        }

        const existing = await getUserRatingForPlace(targetPlaceId, userId);
        if (cancelled) {
          return;
        }

        if (!existing) {
          setValues(DEFAULT_VALUES);
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
  }, [pub, rateOpen, user]);

  const matches = pubs.filter((entry) => entry.name.toLowerCase().includes(search.toLowerCase()));

  const submitRating = async () => {
    if (!user || !pub) {
      return;
    }

    setSaving(true);
    setSubmitError(null);

    try {
      const ratingPayload = {
        user_id: user.id,
        classic_modern: values.modern,
        quiet_lively: values.lively,
        cheap_premium: values.premium,
        local_touristy: values.touristy,
        cozy_spacious: values.spacious,
        price_range: price,
        visit_context: visit,
        note: note.trim() ? note.trim().slice(0, 160) : null,
      };

      if (pub.isExternalCandidate && pub.sourceProvider === "osm" && pub.sourcePlaceId) {
        const externalPayload = rateExternalPlace ?? {
          sourceProvider: "osm" as const,
          sourcePlaceId: pub.sourcePlaceId,
          name: pub.name,
          category: pub.category ?? "bar",
          venueType: pub.venueType ?? "bar",
          priceRange: price ?? null,
          address: pub.address ?? pub.area,
          city: pub.city,
          country: pub.country ?? "Hungary",
          latitude: pub.lat,
          longitude: pub.lng,
          imageUrl: pub.image.trim() ? pub.image : null,
          openingHours: pub.openingHours ?? null,
          phone: pub.phone ?? null,
          email: pub.email ?? null,
          website: pub.website ?? null,
          };

        await upsertExternalPlaceFirstRating(
          {
            source_provider: "osm",
            source_place_id: externalPayload.sourcePlaceId,
            name: externalPayload.name,
            category: externalPayload.category,
            venue_type: externalPayload.venueType,
            price_range: null,
            address: externalPayload.address,
            city: externalPayload.city,
            country: externalPayload.country,
            latitude: externalPayload.latitude,
            longitude: externalPayload.longitude,
            description: null,
            image_url: null,
            opening_hours: externalPayload.openingHours ?? null,
            phone: externalPayload.phone ?? null,
            email: externalPayload.email ?? null,
            website: externalPayload.website ?? null,
          },
          ratingPayload,
        );
      } else {
        await upsertPlaceRating({
          ...ratingPayload,
          place_id: pub.id,
        });
      }
      await refresh();
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not save your rating.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {rateOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeRate}
            className="absolute inset-0 bg-black/40 z-40"
          />

          {/* Sheet */}
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="absolute inset-x-0 bottom-0 h-[93%] z-50 flex flex-col bg-[#fbf8f3] rounded-t-3xl shadow-[0_-8px_40px_rgba(0,0,0,0.16)]"
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1 flex-none">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-gray-100">
              <div className="text-gray-900">Rate this place</div>
              <button
                onClick={closeRate}
                className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {!pub ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="text-gray-900 text-xl">No places available</div>
                <div className="text-[13px] text-gray-600 mt-2 max-w-xs">
                  Add places in Supabase first, then rate them here.
                </div>
              </div>
            ) : !user ? (
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
                <div className="text-gray-900 text-xl">Log in to rate places</div>
                <div className="text-[13px] text-gray-600 mt-2 max-w-xs">
                  Your rating helps improve each place profile for the community.
                </div>
                <button
                  onClick={() => {
                    closeRate();
                    openAuthModal();
                  }}
                  className="mt-6 w-full max-w-sm py-3 rounded-2xl bg-gray-900 text-white"
                >
                  Log in
                </button>
              </div>
            ) : submitted ? (
              /* Success state */
              <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
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
                <button
                  onClick={closeRate}
                  className="mt-6 w-full max-w-sm py-3 rounded-2xl bg-gray-900 text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-4 py-4 pb-[calc(10rem+env(safe-area-inset-bottom))] space-y-5">
                  {/* Pub selector */}
                  <div>
                    <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Pub</div>
                    {!picking ? (
                      <button
                        onClick={() => setPicking(true)}
                        className="w-full rounded-2xl bg-white border border-gray-200 overflow-hidden text-left"
                      >
                        <div className="relative h-28">
                          <VenueImage pub={pub} alt={pub.name} className="w-full h-full object-cover" />
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
                            autoFocus
                            className="w-full pl-9 pr-3 py-2 rounded-xl bg-gray-50 outline-none text-[13px]"
                          />
                        </div>
                        <div className="mt-2 max-h-40 overflow-y-auto">
                          {matches.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => { setPub(p); setPicking(false); }}
                              className="w-full text-left p-2 rounded-xl hover:bg-gray-50 text-[13px] flex items-center gap-2"
                            >
                              <VenueImage pub={p} alt={p.name} className="w-9 h-9 rounded-lg object-cover flex-none" />
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

                  {/* When did you visit */}
                  <div>
                    <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">When did you visit?</div>
                    <div className="grid grid-cols-2 gap-2">
                      {VISIT_OPTIONS.slice(0, 4).map((opt) => {
                        const sel = visit === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setVisit(opt.value as VisitContext)}
                            className="rounded-2xl p-3 flex flex-col items-start gap-2 border transition-all text-left"
                            style={sel
                              ? { background: opt.bg, borderColor: opt.border, borderWidth: 1.5 }
                              : { background: "#fff", borderColor: "#f3f4f6", borderWidth: 1 }}
                          >
                            <opt.Icon weight="duotone" size={24} style={{ color: sel ? opt.color : "#9ca3af" }} />
                            <div>
                              <div className="text-[13px] leading-tight" style={{ color: sel ? opt.color : "#111827" }}>{opt.time}</div>
                              <div className="text-[11px] text-gray-400 mt-0.5">{opt.day}</div>
                            </div>
                          </button>
                        );
                      })}
                      {(() => {
                        const opt = VISIT_OPTIONS[4];
                        const sel = visit === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => setVisit(opt.value as VisitContext)}
                            className="col-span-2 rounded-2xl px-4 py-3 flex items-center gap-3 border transition-all"
                            style={sel
                              ? { background: opt.bg, borderColor: opt.border, borderWidth: 1.5 }
                              : { background: "#fff", borderColor: "#f3f4f6", borderWidth: 1 }}
                          >
                            <opt.Icon weight="duotone" size={24} style={{ color: sel ? opt.color : "#9ca3af" }} />
                            <div className="text-[13px]" style={{ color: sel ? opt.color : "#111827" }}>{opt.time}</div>
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

                {/* Submit */}
                <div className="flex-none p-4 pb-[calc(1rem+env(safe-area-inset-bottom)+60px)] border-t border-gray-100 bg-white/90 backdrop-blur">
                  <button
                    onClick={submitRating}
                    disabled={saving}
                    className="w-full py-3.5 rounded-2xl bg-gray-900 text-white shadow-md disabled:opacity-70"
                  >
                    {saving ? "Saving..." : hasExistingRating ? "Update rating" : "Submit rating"}
                  </button>
                  {submitError ? <p className="mt-2 text-[12px] text-red-600">{submitError}</p> : null}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
