import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, MapPin, Search, X } from "lucide-react";
import { SLIDERS } from "../vibe";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { AdUnit } from "../AdUnit";
import { getMatchPillStyle } from "../matchColors";
import { usePlaces } from "../../context/PlacesContext";
import { calculateStrictSimilarityMatch } from "../similarityScore";
import { formatPubAddress } from "../placeAddress";
import { getTraitPillSlug } from "@/lib/chips";

const PAGE_SIZE = 12;
const MIN_MATCH_PERCENT = 50;

export function SimilarScreen() {
  const navigate = useNavigate();
  const { pubs } = usePlaces();
  const { id } = useParams<{ id: string }>();
  const base = pubs.find((p) => p.id === id) ?? pubs[0];
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
    if (!query.trim()) {
      return allSimilar;
    }

    const q = query.toLowerCase().trim();
    return allSimilar.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.chips.some((chip) => chip.toLowerCase().includes(q)),
    );
  }, [allSimilar, query]);

  const visibleSimilar = useMemo(
    () => similar.slice(0, visibleCount),
    [similar, visibleCount],
  );

  const hasMore = visibleCount < similar.length;

  const openPill = (pill: string, event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    navigate(`/pill/${getTraitPillSlug(pill)}`);
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
      <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 border-b border-gray-100 bg-white/70 backdrop-blur">
        <button
          onClick={() => navigate(-1 as any)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="text-gray-900 text-[16px]">Similar to {base.name}</div>
          <div className="text-[12px] text-gray-500">All compared places from best to worst (50%+)</div>
        </div>
      </div>

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
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-16">
        {similar.length === 0 ? (
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
                    onClick={() => navigate(`/detail/${p.id}`)}
                    className="w-full text-left bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-3"
                  >
                    <div className="flex gap-3">
                      <ImageWithFallback src={p.image} alt={p.name} className="w-20 h-20 rounded-xl object-cover" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-gray-900 truncate">{p.name}</div>
                            <div className="text-[12px] text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              <span className="truncate">{formatPubAddress(p)}</span>
                            </div>
                          </div>
                          <div
                            className="inline-flex items-center whitespace-nowrap px-2 py-0.5 rounded-full text-[11px] border leading-none"
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
