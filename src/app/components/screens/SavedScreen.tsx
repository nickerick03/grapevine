import { useState } from "react";
import { useNavigate } from "react-router";
import { Search, X } from "lucide-react";
import { BookmarkSimple, Trash, MapPin, Star } from "@phosphor-icons/react";
import { PUBS, SLIDERS } from "../vibe";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { BottomNav } from "../BottomNav";
import { AppLogo } from "../AppLogo";
import { AdUnit } from "../AdUnit";

const INITIAL_SAVED = [PUBS[0], PUBS[2], PUBS[3], PUBS[5]];

export function SavedScreen() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(INITIAL_SAVED);
  const [query, setQuery] = useState("");

  const filtered = saved.filter(
    (p) =>
      !query ||
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.area.toLowerCase().includes(query.toLowerCase())
  );

  function handleUnsave(id: string, e: { stopPropagation: () => void }) {
    e.stopPropagation();
    setSaved((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      {/* Header */}
      <div className="flex-none px-4 pt-4 pb-3 bg-white/80 backdrop-blur border-b border-gray-100">
        <div className="flex items-center gap-3 mb-3">
          <AppLogo />
          <div className="flex-1">
            <div className="text-gray-900 text-[17px]">Saved Places</div>
          </div>
          <div className="text-[12px] text-gray-400">{saved.length} places</div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search saved places…"
            className="w-full pl-9 pr-9 py-2 rounded-full bg-gray-100 text-[13px] outline-none focus:bg-white border border-transparent focus:border-gray-200 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-300 flex items-center justify-center"
            >
              <X className="w-3 h-3 text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-3 pb-[76px]">
        {saved.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center mb-4">
              <BookmarkSimple size={28} weight="duotone" className="text-blue-400" />
            </div>
            <div className="text-gray-900 text-[16px]">No saved places yet</div>
            <div className="text-[13px] text-gray-500 mt-2 max-w-xs">
              Tap the bookmark icon on any pub to save it for later.
            </div>
            <button
              onClick={() => navigate("/")}
              className="mt-5 px-5 py-2.5 rounded-full bg-gray-900 text-white text-[13px]"
            >
              Explore pubs
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-2xl mb-3">🔍</div>
            <div className="text-gray-700">No results for &ldquo;{query}&rdquo;</div>
          </div>
        ) : (
          <>
            {query && (
              <div className="text-[11px] text-gray-400 mb-2 px-1">
                {filtered.length} result{filtered.length !== 1 ? "s" : ""}
              </div>
            )}
            {/* Ad — above saved places */}
            <AdUnit variant="rectangle" index={3} className="mb-3" />
            <div className="grid grid-cols-2 gap-3">
              {filtered.map((pub) => (
                <div
                  key={pub.id}
                  onClick={() => navigate(`/detail/${pub.id}`)}
                  className="text-left bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-[0_2px_12px_rgba(0,0,0,0.05)] group cursor-pointer"
                >
                  <div className="relative h-28">
                    <ImageWithFallback
                      src={pub.image}
                      alt={pub.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

                    {/* Match badge */}
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-white text-[10px] border border-white/20">
                      {pub.match}%
                    </div>

                    {/* Unsave button */}
                    <button
                      onClick={(e) => handleUnsave(pub.id, e)}
                      className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/40 backdrop-blur-sm border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash size={11} weight="fill" className="text-white" />
                    </button>

                    {/* Name overlay */}
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="text-white text-[12px] truncate">{pub.name}</div>
                    </div>
                  </div>

                  <div className="p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-1 text-[10px] text-gray-500">
                        <MapPin size={9} weight="duotone" className="text-blue-400" />
                        {pub.area}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Star size={9} weight="fill" className="text-amber-400" />
                        <span className="text-[10px] text-gray-500">{pub.ratings}</span>
                      </div>
                    </div>

                    <div className="flex gap-0.5">
                      {SLIDERS.map((s) => (
                        <div key={s.key} className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pub.vibe[s.key]}%`, background: s.color, opacity: 0.7 }}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {pub.chips.slice(0, 2).map((c) => (
                        <span key={c} className="text-[9.5px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 mb-2">
              <button
                onClick={() => navigate("/")}
                className="w-full py-3 rounded-2xl border border-dashed border-gray-300 text-gray-500 text-[13px] hover:border-gray-400 hover:text-gray-700 transition-colors"
              >
                + Explore more pubs
              </button>
            </div>
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}