import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronDown, MapPin, Search, X } from "lucide-react";
import { SLIDERS } from "../vibe";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { AdUnit } from "../AdUnit";
import { getMatchPillStyle } from "../matchColors";
import { usePlaces } from "../../context/PlacesContext";
import { useAuth } from "../../context/AuthContext";
import { useFilters } from "../../context/FilterContext";
import { calculateStrictSimilarityMatch } from "../similarityScore";
import { formatPubAddress } from "../placeAddress";
import { getTraitPillSlug } from "@/lib/chips";
import { getSavedPlaceIds } from "@/lib/services/places";
import { searchWorldCities } from "@/lib/services/cities";

const PAGE_SIZE = 12;
const MIN_MATCH_PERCENT = 50;
const RECENT_VENUES_KEY = "grapevine.recentVenueIds.v1";
const SIMILAR_BACK_DEPTH_THRESHOLD = 2;

type SimilarFlowState = {
  similarDepth?: number;
  backTarget?: string;
  fromSimilarFlow?: boolean;
};

export function SimilarScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { selectedCity } = useFilters();
  const { pubs, loading: placesLoading } = usePlaces();
  const { id } = useParams<{ id: string }>();
  const incomingState = (location.state ?? null) as SimilarFlowState | null;
  const similarDepth = incomingState?.similarDepth ?? 1;
  const backTarget = incomingState?.backTarget ?? "/";
  const shouldCollapseBack = similarDepth >= SIMILAR_BACK_DEPTH_THRESHOLD;
  const [activeBaseId, setActiveBaseId] = useState<string | null>(id ?? null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectorQuery, setSelectorQuery] = useState("");
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>("All cities");
  const [cityDropdownOpen, setCityDropdownOpen] = useState(false);
  const [cityQuery, setCityQuery] = useState("");
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [citySearchLoading, setCitySearchLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (id) {
      setActiveBaseId(id);
      return;
    }
    if (!activeBaseId && pubs.length > 0) {
      setActiveBaseId(pubs[0].id);
    }
  }, [activeBaseId, id, pubs]);

  const base = useMemo(
    () => pubs.find((p) => p.id === activeBaseId) ?? pubs[0],
    [activeBaseId, pubs],
  );

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setSavedIds([]);
      return;
    }
    void getSavedPlaceIds(user.id)
      .then((ids) => {
        if (!cancelled) {
          setSavedIds(ids);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSavedIds([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const recentIds = useMemo(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_VENUES_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [] as string[];
      return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
    } catch {
      return [] as string[];
    }
  }, [base?.id]);

  const selectorPool = useMemo(() => {
    const orderedIds = Array.from(new Set([...(savedIds ?? []), ...recentIds, ...(id ? [id] : []), ...(base?.id ? [base.id] : [])]));
    const byId = new Map(pubs.map((p) => [p.id, p]));
    const preferred = orderedIds.map((venueId) => byId.get(venueId)).filter((venue): venue is NonNullable<typeof venue> => Boolean(venue));
    return preferred.length > 0 ? preferred : pubs;
  }, [base?.id, id, pubs, recentIds, savedIds]);

  const selectorResults = useMemo(() => {
    const q = selectorQuery.trim().toLowerCase();
    if (!q) {
      return selectorPool;
    }
    // On typed search, allow finding any venue in dataset.
    return pubs.filter((p) => {
      const haystack = [p.name, p.city, p.area, p.address ?? "", ...(p.chips ?? [])].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [pubs, selectorPool, selectorQuery]);

  const allSimilar = useMemo(() => {
    if (!base || base.ratings <= 0) {
      return [];
    }

    return pubs
      .filter((p) => p.id !== base.id && p.ratings > 0)
      .map((p) => {
        const match = calculateStrictSimilarityMatch(base.vibe, p.vibe);
        const shared = p.chips.filter((c) => base.chips.includes(c));
        return { ...p, match, shared };
      })
      .filter((p) => p.match >= MIN_MATCH_PERCENT)
      .sort((a, b) => b.match - a.match);
  }, [base, pubs]);

  const similar = useMemo(() => {
    const byCity = selectedCityFilter === "All cities"
      ? allSimilar
      : allSimilar.filter((p) => p.city === selectedCityFilter);

    if (!query.trim()) {
      return byCity;
    }

    const q = query.toLowerCase().trim();
    return byCity.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.chips.some((chip) => chip.toLowerCase().includes(q)),
    );
  }, [allSimilar, query, selectedCityFilter]);

  const cityOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const venue of selectorPool) {
      if (!venue.city) continue;
      counts.set(venue.city, (counts.get(venue.city) ?? 0) + 1);
    }
    const mostViewed = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([city]) => city);
    const uniqueAll = Array.from(new Set(allSimilar.map((p) => p.city).filter(Boolean)));
    const merged = Array.from(new Set([...mostViewed, ...uniqueAll]));
    const normalizedCurrent = (selectedCity ?? "").trim();
    const withoutCurrent = merged.filter((city) => city !== normalizedCurrent);
    if (!normalizedCurrent) {
      return ["All cities", ...withoutCurrent, "Other"];
    }
    return ["All cities", normalizedCurrent, ...withoutCurrent, "Other"];
  }, [allSimilar, selectedCity, selectorPool]);

  useEffect(() => {
    if (selectedCityFilter !== "Other") {
      setCityDropdownOpen(false);
      setCityQuery("");
      setCitySuggestions([]);
    }
  }, [selectedCityFilter]);

  useEffect(() => {
    if (selectedCityFilter !== "Other") {
      setCitySearchLoading(false);
      return;
    }

    const q = cityQuery.trim();
    if (q.length < 2) {
      setCitySuggestions([]);
      setCitySearchLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setCitySearchLoading(true);
      searchWorldCities(q, controller.signal)
        .then((suggestions) => setCitySuggestions(suggestions))
        .catch(() => setCitySuggestions([]))
        .finally(() => setCitySearchLoading(false));
    }, 220);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [cityQuery, selectedCityFilter]);

  const visibleSimilar = useMemo(
    () => similar.slice(0, visibleCount),
    [similar, visibleCount],
  );

  const hasMore = visibleCount < similar.length;

  const openPill = (pill: string, event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    navigate(`/pill/${getTraitPillSlug(pill)}`);
  };

  const selectBaseVenue = (venueId: string) => {
    setActiveBaseId(venueId);
    setSelectorOpen(false);
    setSelectorQuery("");
    navigate(`/similar/${venueId}`, {
      replace: true,
      state: {
        similarDepth,
        backTarget,
        fromSimilarFlow: true,
      } satisfies SimilarFlowState,
    });
  };

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [base?.id, query]);

  useEffect(() => {
    if (!hasMore) {
      return;
    }

    const root = listRef.current;
    const marker = loadMoreRef.current;
    if (!root || !marker) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (!first?.isIntersecting) {
          return;
        }

        setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, similar.length));
      },
      {
        root,
        rootMargin: "120px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(marker);
    return () => observer.disconnect();
  }, [hasMore, similar.length]);

  if (!base) {
    return (
      <div className="absolute inset-0 bg-[#fbf8f3] flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-gray-900">No places available yet</div>
          <button onClick={() => navigate("/")} className="mt-3 rounded-full bg-gray-900 px-4 py-2 text-white text-[13px]">
            Back to explore
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 border-b border-gray-100 bg-white/70 backdrop-blur relative z-20">
        <button
          onClick={() => {
            if (shouldCollapseBack) {
              navigate(backTarget, { replace: true });
              return;
            }
            navigate(-1 as any);
          }}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-gray-900 text-[16px] shrink-0">Similar to</span>
          <button
            onClick={() => setSelectorOpen((prev) => !prev)}
            className="inline-flex max-w-full rounded-2xl border border-gray-200 bg-white overflow-hidden"
          >
            <div className="px-3 py-2 inline-flex items-center gap-1 text-left">
              <div className="min-w-0 text-gray-900 text-[16px] truncate">{base.name}</div>
              <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform shrink-0 ${selectorOpen ? "rotate-180" : ""}`} />
            </div>
          </button>
        </div>
      </div>

      {selectorOpen ? (
        <div className="flex-none -mt-px border-b border-gray-100 bg-white relative z-10">
          <button
            onClick={() => setSelectorOpen(false)}
            className="sr-only"
            aria-hidden="true"
          >
          </button>
          <div className="px-4 py-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              <input
                value={selectorQuery}
                onChange={(e) => setSelectorQuery(e.target.value)}
                placeholder="Search saved or recent venues..."
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:border-gray-400"
              />
            </div>
            <div className="mt-2 max-h-56 overflow-y-auto space-y-1">
              {placesLoading ? (
                <div className="px-2 py-2 text-[12px] text-gray-500">Loading venues…</div>
              ) : selectorResults.length === 0 ? (
                <div className="px-2 py-2 text-[12px] text-gray-500">No venues found.</div>
              ) : (
                selectorResults.map((venue) => {
                  const active = base?.id === venue.id;
                  return (
                    <button
                      key={venue.id}
                      onClick={() => selectBaseVenue(venue.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-xl border text-[12px] ${
                        active ? "border-gray-900 bg-gray-50 text-gray-900" : "border-gray-200 bg-white text-gray-700"
                      }`}
                    >
                      <div className="truncate">{venue.name}</div>
                      <div className="text-[11px] text-gray-500 truncate">{venue.city}</div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex-none px-4 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search similar places..."
            className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-white border border-gray-200 shadow-sm text-[13px] outline-none focus:border-gray-400 transition-colors"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
            >
              <X className="w-3 h-3 text-gray-600" />
            </button>
          )}
        </div>
        <div className="text-[11px] text-gray-400 mt-1.5 px-1">
          Showing {Math.min(visibleCount, similar.length)} of {similar.length} places
          {query ? ` for "${query}"` : ""}
        </div>
        <div className="mt-2 -mx-1 px-1 overflow-x-auto">
          <div className="inline-flex gap-1.5 pb-0.5">
            {cityOptions.map((city) => {
              const active = city === selectedCityFilter;
              return (
                <button
                  key={city}
                  onClick={() => setSelectedCityFilter(city)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border whitespace-nowrap ${
                    active
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200"
                  }`}
                >
                  {city}
                </button>
              );
            })}
          </div>
        </div>
        {selectedCityFilter === "Other" ? (
          <div className="mt-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              value={cityQuery}
              onChange={(event) => {
                setCityQuery(event.target.value);
                setCityDropdownOpen(true);
              }}
              onFocus={() => setCityDropdownOpen(true)}
              onBlur={() => {
                setTimeout(() => setCityDropdownOpen(false), 120);
              }}
              placeholder="Type any city..."
              className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-[12px] outline-none focus:border-gray-400"
            />
            {cityDropdownOpen ? (
              <div className="absolute top-full left-0 right-0 mt-1 rounded-xl border border-gray-100 bg-white shadow-lg z-20 overflow-hidden">
                {citySearchLoading && citySuggestions.length === 0 ? (
                  <div className="px-3 py-2 text-[12px] text-gray-500">Searching cities…</div>
                ) : null}
                {!citySearchLoading && citySuggestions.length === 0 && cityQuery.trim().length >= 2 ? (
                  <div className="px-3 py-2 text-[12px] text-gray-500">No city matches found.</div>
                ) : null}
                {citySuggestions.map((city) => (
                  <button
                    key={city}
                    onClick={() => {
                      setSelectedCityFilter(city);
                      setCityQuery(city);
                      setCityDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-[12px] hover:bg-gray-50"
                  >
                    {city}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-16">
        {placesLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-gray-700">Loading similar places…</div>
          </div>
        ) : similar.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-2xl">🍺</div>
            <div className="text-gray-700">
              {base.ratings > 0 ? "No similar places above 50% yet" : "This place needs ratings first"}
            </div>
            <div className="text-[12px] text-gray-500 mt-1">
              {base.ratings > 0 ? "Try another place or search phrase." : "After more ratings, we can compare it properly."}
            </div>
          </div>
        ) : (
          visibleSimilar.map((p, i) => (
            <div key={p.id}>
              {(() => {
                const hasComparisonData = base.ratings > 0 && p.ratings > 0;
                return (
                  <button
                    onClick={() =>
                      navigate(`/detail/${p.id}`, {
                        state: {
                          fromSimilarFlow: true,
                          similarDepth,
                          backTarget,
                        } satisfies SimilarFlowState,
                      })}
                    className="w-full text-left bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-3"
                  >
                    <div className="flex gap-3">
                      <ImageWithFallback src={p.image} alt={p.name} className="w-20 h-20 rounded-xl object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-gray-900 truncate">{p.name}</div>
                            <div className="text-[12px] text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{formatPubAddress(p)}</span>
                            </div>
                          </div>
                          <div
                            className="inline-flex shrink-0 items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] border leading-none self-start"
                            style={getMatchPillStyle(p.match)}
                          >
                            {p.match}%&nbsp;match
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {p.shared.length ? (
                            p.shared.map((c) => (
                              <span
                                key={c}
                                onClick={(event) => openPill(c, event)}
                                className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100 cursor-pointer hover:bg-amber-100 transition-colors"
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    openPill(c);
                                  }
                                }}
                              >
                                {c}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-gray-400">No shared traits</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {SLIDERS.map((s) => {
                        const leadingLabel = p.vibe[s.key] >= 50 ? s.right : s.left;
                        return (
                        <div key={s.key} className="flex items-center gap-2">
                          {hasComparisonData ? (
                            <span className="w-[86px] shrink-0 text-[11px] text-gray-600 leading-none">
                              {leadingLabel}
                            </span>
                          ) : null}
                          <div className="flex-1 relative h-1.5 rounded-full bg-gray-100">
                            {hasComparisonData ? (
                              <>
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full"
                                  style={{ width: `${p.vibe[s.key]}%`, background: s.color, opacity: 0.45 }}
                                />
                                <div
                                  className="absolute -top-0.5 w-0.5 h-2.5 bg-gray-700"
                                  style={{ left: `${base.vibe[s.key]}%` }}
                                />
                                <div
                                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow"
                                  style={{ left: `${p.vibe[s.key]}%`, background: s.color }}
                                />
                              </>
                            ) : null}
                          </div>
                        </div>
                        );
                      })}
                    </div>
                  </button>
                );
              })()}
              {i === 1 && (
                <div className="mt-3">
                  <AdUnit variant="rectangle" />
                </div>
              )}
            </div>
          ))
        )}

        {similar.length > 0 ? (
          <div ref={loadMoreRef} className="pt-1 pb-3 text-center">
            {hasMore ? (
              <div className="inline-flex items-center gap-2 text-[12px] text-gray-500">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
                Loading more similar places...
              </div>
            ) : (
              <div className="text-[12px] text-gray-500">
                End of results at {MIN_MATCH_PERCENT}% match threshold.
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
