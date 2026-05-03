import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, ChevronDown, Search, X } from "lucide-react";
import { PUBS, SLIDERS, CITIES } from "../vibe";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { AdUnit } from "../AdUnit";

export function SimilarScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const base = PUBS.find((p) => p.id === id) ?? PUBS[0];
  const [city, setCity] = useState(base.city);
  const [query, setQuery] = useState("");

  const allSimilar = useMemo(() =>
    PUBS.filter((p) => p.id !== base.id)
      .map((p) => {
        const dist = SLIDERS.reduce((acc, s) => acc + Math.abs(p.vibe[s.key] - base.vibe[s.key]), 0);
        const match = Math.max(40, 100 - Math.round(dist / 5));
        const shared = p.chips.filter((c) => base.chips.includes(c));
        return { ...p, match, shared };
      })
      .sort((a, b) => b.match - a.match),
  [base]);

  const similar = useMemo(() => {
    if (!query.trim()) return allSimilar;
    const q = query.toLowerCase();
    return allSimilar.filter(
      (p) => p.name.toLowerCase().includes(q) || p.area.toLowerCase().includes(q)
    );
  }, [allSimilar, query]);

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center gap-3 px-4 py-3 border-b border-gray-100 bg-white/70 backdrop-blur">
        <button
          onClick={() => navigate(-1 as any)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <div className="text-gray-900">Similar to {base.name}</div>
          <div className="text-[12px] text-gray-500">Compare 5 vibe traits</div>
        </div>
        <div className="relative">
          <select
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="appearance-none pl-3 pr-7 py-1.5 rounded-full bg-white border border-gray-200 text-[12px]"
          >
            {CITIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500" />
        </div>
      </div>

      {/* Search bar */}
      <div className="flex-none px-4 pt-3 pb-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or area…"
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
        {query && (
          <div className="text-[11px] text-gray-400 mt-1.5 px-1">
            {similar.length} {similar.length === 1 ? "result" : "results"} for "{query}"
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-16">
        {similar.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3 text-2xl">🍺</div>
            <div className="text-gray-700">No places found</div>
            <div className="text-[12px] text-gray-500 mt-1">Try a different search term</div>
          </div>
        ) : (
          similar.map((p, i) => (
            <div key={p.id}>
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
                        <div className="text-[12px] text-gray-500">{p.area}</div>
                      </div>
                      <div className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] border border-emerald-100">
                        {p.match}% match
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {p.shared.length ? (
                        p.shared.map((c) => (
                          <span key={c} className="text-[10.5px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-[11px] text-gray-400">No shared vibes</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  {SLIDERS.map((s) => (
                    <div key={s.key} className="flex items-center gap-2">
                      <span className="w-12 text-[10px] text-gray-500">{s.right}</span>
                      <div className="flex-1 relative h-1.5 rounded-full bg-gray-100">
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
                      </div>
                    </div>
                  ))}
                </div>
              </button>
              {/* Rectangle ad after the 2nd place (index 1) */}
              {i === 1 && (
                <div className="mt-3">
                  <AdUnit variant="rectangle" index={2} />
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Donation link */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#fbf8f3] via-[#fbf8f3] to-transparent pointer-events-none">
        <div className="text-center pointer-events-auto">
          <button className="text-[13px] text-gray-600 underline decoration-dotted underline-offset-2 hover:text-gray-900">
            Support VibeMap with a donation
          </button>
        </div>
      </div>
    </div>
  );
}