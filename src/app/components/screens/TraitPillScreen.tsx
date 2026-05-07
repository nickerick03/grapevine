import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, MapPin, Search, X } from "lucide-react";
import { SLIDERS } from "../vibe";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { AdUnit } from "../AdUnit";
import { usePlaces } from "../../context/PlacesContext";
import { formatPubAddress } from "../placeAddress";
import { getTraitPillBySlug, getTraitPillSlug } from "@/lib/chips";

const PAGE_SIZE = 14;

export function TraitPillScreen() {
  const navigate = useNavigate();
  const { slug = "" } = useParams<{ slug: string }>();
  const { pubs } = usePlaces();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const listRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const pillDefinition = useMemo(() => getTraitPillBySlug(slug), [slug]);

  const matching = useMemo(() => {
    if (!pillDefinition) {
      return [];
    }

    return pubs
      .filter((pub) => pub.ratings > 0)
      .filter((pub) => pub.chips.includes(pillDefinition.label))
      .sort((a, b) => {
        if (b.ratings !== a.ratings) {
          return b.ratings - a.ratings;
        }
        return a.name.localeCompare(b.name);
      });
  }, [pillDefinition, pubs]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return matching;
    }

    const q = query.toLowerCase().trim();
    return matching.filter(
      (pub) =>
        pub.name.toLowerCase().includes(q) ||
        pub.city.toLowerCase().includes(q) ||
        (pub.address ?? pub.area).toLowerCase().includes(q) ||
        pub.chips.some((chip) => chip.toLowerCase().includes(q)),
    );
  }, [matching, query]);

  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const hasMore = visibleCount < filtered.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [slug, query]);

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
        if (entries[0]?.isIntersecting) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, filtered.length));
        }
      },
      {
        root,
        rootMargin: "120px 0px",
        threshold: 0.1,
      },
    );

    observer.observe(marker);
    return () => observer.disconnect();
  }, [filtered.length, hasMore]);

  const openPill = (pill: string, event?: { stopPropagation: () => void }) => {
    event?.stopPropagation();
    navigate(`/pill/${getTraitPillSlug(pill)}`);
  };

  if (!pillDefinition) {
    return (
      <div className="absolute inset-0 bg-[#fbf8f3] flex items-center justify-center px-6 text-center">
        <div>
          <div className="text-gray-900">Trait pill not found</div>
          <button onClick={() => navigate(-1 as never)} className="mt-3 rounded-full bg-gray-900 px-4 py-2 text-white text-[13px]">
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 border-b border-gray-100 bg-white/70 backdrop-blur">
        <button
          onClick={() => navigate(-1 as never)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-gray-900 text-[16px] truncate">{pillDefinition.label}</div>
          <div className="text-[12px] text-gray-500 truncate">{pillDefinition.description}</div>
        </div>
      </div>

      <div className="flex-none px-4 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search places in this trait..."
            className="w-full pl-9 pr-9 py-2.5 rounded-2xl bg-white border border-gray-200 shadow-sm text-[13px] outline-none focus:border-gray-400 transition-colors"
          />
          {query ? (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
            >
              <X className="w-3 h-3 text-gray-600" />
            </button>
          ) : null}
        </div>
        <div className="text-[11px] text-gray-400 mt-1.5 px-1">
          Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} places
          {query ? ` for "${query}"` : ""}
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-16">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-2xl">🧭</div>
            <div className="text-gray-700">No places found for this trait yet</div>
            <div className="text-[12px] text-gray-500 mt-1">Try a different trait pill.</div>
          </div>
        ) : (
          visible.map((pub, index) => (
            <div key={pub.id}>
              <button
                onClick={() => navigate(`/detail/${pub.id}`)}
                className="w-full text-left bg-white rounded-3xl border border-gray-100 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-3"
              >
                <div className="flex gap-3">
                  <ImageWithFallback src={pub.image} alt={pub.name} className="w-20 h-20 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="text-gray-900 truncate">{pub.name}</div>
                    <div className="text-[12px] text-gray-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{formatPubAddress(pub)}</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5">{pub.ratings} ratings</div>

                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {pub.chips.slice(0, 4).map((chip) => (
                        <span
                          key={chip}
                          onClick={(event) => openPill(chip, event)}
                          className={`text-[10.5px] px-1.5 py-0.5 rounded-full border transition-colors cursor-pointer ${
                            chip === pillDefinition.label
                              ? "bg-amber-100 border-amber-300 text-amber-800"
                              : "bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100"
                          }`}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openPill(chip);
                            }
                          }}
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex gap-1">
                  {SLIDERS.map((slider) => (
                    <div key={slider.key} className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pub.vibe[slider.key]}%`, background: slider.color }}
                      />
                    </div>
                  ))}
                </div>
              </button>

              {index === 1 ? (
                <div className="mt-3">
                  <AdUnit variant="rectangle" />
                </div>
              ) : null}
            </div>
          ))
        )}

        {filtered.length > 0 ? (
          <div ref={loadMoreRef} className="pt-1 pb-3 text-center">
            {hasMore ? (
              <div className="inline-flex items-center gap-2 text-[12px] text-gray-500">
                <span className="inline-block h-3 w-3 rounded-full border-2 border-gray-300 border-t-transparent animate-spin" />
                Loading more places...
              </div>
            ) : (
              <div className="text-[12px] text-gray-500">You reached the end of this trait list.</div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
