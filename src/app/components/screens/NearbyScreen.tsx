import { useState } from "react";
import { useNavigate } from "react-router";
import { Search, X } from "lucide-react";
import { NavigationArrow, MapPin, Star } from "@phosphor-icons/react";
import { PUBS, SLIDERS } from "../vibe";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { BottomNav } from "../BottomNav";
import { AppLogo } from "../AppLogo";
import { useUI } from "../../context/UIContext";
import { AdUnit } from "../AdUnit";

// Mock distances sorted closest first
const MOCK_DISTANCES: Record<string, number> = {
  "1": 0.3,
  "6": 0.4,
  "2": 0.5,
  "3": 0.7,
  "5": 0.9,
  "4": 1.1,
};

const SORTED_PUBS = [...PUBS].sort(
  (a, b) => (MOCK_DISTANCES[a.id] ?? 9) - (MOCK_DISTANCES[b.id] ?? 9)
);

export function NearbyScreen() {
  const navigate = useNavigate();
  const { openRate } = useUI();
  const [query, setQuery] = useState("");
  const [locating, setLocating] = useState(false);

  const filtered = SORTED_PUBS.filter((p) =>
    !query || p.name.toLowerCase().includes(query.toLowerCase()) || p.area.toLowerCase().includes(query.toLowerCase())
  );

  const handleLocate = () => {
    setLocating(true);
    setTimeout(() => setLocating(false), 1800);
  };

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      {/* Sticky header — search + title only */}
      <div className="flex-none px-4 pt-4 pb-3 bg-white/80 backdrop-blur border-b border-gray-100 z-10">
        <div className="flex items-center gap-3 mb-3">
          <AppLogo />
          <div className="flex-1">
            <div className="text-gray-900 text-[17px]">Bars Near You</div>
          </div>
          <button
            onClick={handleLocate}
            className={`w-10 h-10 rounded-full shadow border flex items-center justify-center transition-all duration-300 ${
              locating
                ? "bg-blue-500 border-blue-400 text-white"
                : "bg-white border-gray-200 text-gray-600"
            }`}
          >
            <NavigationArrow
              weight={locating ? "fill" : "regular"}
              size={18}
              className={locating ? "animate-pulse" : ""}
            />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search bars…"
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

      {/* Single scrollable body — map, ad, and list all scroll together */}
      <div className="flex-1 overflow-y-auto pb-[76px]">
        {/* User location indicator */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-white shadow flex-none" />
          <span className="text-[12px] text-gray-500">Your location · District VII, Budapest</span>
        </div>

        {/* Mini map strip — scrolls with content */}
        <div className="mx-4 mb-3 rounded-2xl overflow-hidden h-44 relative border border-gray-100 shadow-sm">
          {/* Map background */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 30% 20%, #fef3e9 0%, transparent 40%), radial-gradient(circle at 70% 60%, #eaf2fb 0%, transparent 50%), linear-gradient(180deg, #f5f1ea 0%, #ecf1ec 100%)",
            }}
          />
          <svg className="absolute inset-0 w-full h-full opacity-40" preserveAspectRatio="none" viewBox="0 0 100 40">
            {Array.from({ length: 5 }).map((_, i) => (
              <line key={`h${i}`} x1="0" y1={i * 8} x2="100" y2={i * 8} stroke="#d8d2c5" strokeWidth="0.3" />
            ))}
            {Array.from({ length: 13 }).map((_, i) => (
              <line key={`v${i}`} x1={i * 8} y1="0" x2={i * 8} y2="40" stroke="#d8d2c5" strokeWidth="0.3" />
            ))}
            <path d="M0,22 Q30,16 55,20 T100,18" stroke="#cfe0f5" strokeWidth="2" fill="none" />
            <path d="M20,0 Q25,12 35,22 T45,40" stroke="#dde6d3" strokeWidth="2.5" fill="none" opacity="0.6" />
          </svg>

          {/* Pub pins */}
          {SORTED_PUBS.slice(0, 5).map((p, i) => (
            <button
              key={p.id}
              onClick={() => navigate(`/detail/${p.id}`)}
              className="absolute"
              style={{
                left: `${15 + i * 16}%`,
                top: `${25 + (i % 3) * 22}%`,
                transform: "translate(-50%, -100%)",
              }}
            >
              <div className="px-2 py-0.5 rounded-full bg-white border border-gray-200 shadow text-[9px] text-gray-700 whitespace-nowrap">
                {p.name.split(" ")[0]}
              </div>
            </button>
          ))}

          {/* User dot */}
          <div className="absolute" style={{ left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}>
            <div className="absolute w-6 h-6 rounded-full bg-blue-400/20 animate-ping -translate-x-1/4 -translate-y-1/4" />
            <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-lg" />
          </div>

          {/* Badge */}
          <div className="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] text-gray-500 border border-gray-100 shadow-sm">
            All bars · no filter
          </div>
        </div>

        {/* Ad — under the map, scrolls with everything */}
        <div className="px-4 mb-3">
          <AdUnit variant="rectangle" index={1} />
        </div>

        {/* Place list */}
        <div className="px-4 space-y-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-2xl mb-3">🍺</div>
              <div className="text-gray-700">No bars found</div>
            </div>
          ) : (
            filtered.map((pub, i) => {
              const dist = MOCK_DISTANCES[pub.id];
              // Ad after every 3rd place
              const showAd = i > 0 && i % 3 === 0;
              return (
                <div key={pub.id}>
                  {showAd && <AdUnit variant="native" index={i} className="mb-2" />}
                  <button
                    onClick={() => navigate(`/detail/${pub.id}`)}
                    className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden flex gap-0"
                  >
                    <div className="relative w-24 flex-none">
                      <ImageWithFallback src={pub.image} alt={pub.name} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/5" />
                    </div>
                    <div className="flex-1 p-3 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-gray-900 text-[14px] truncate">{pub.name}</div>
                          <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                            <MapPin size={10} weight="duotone" className="text-blue-400" />
                            {pub.area}
                          </div>
                        </div>
                        <div className="flex-none text-right">
                          <div className="text-[12px] text-blue-600">{dist} km</div>
                          <div className="flex items-center gap-0.5 mt-0.5 justify-end">
                            <Star size={10} weight="fill" className="text-amber-400" />
                            <span className="text-[11px] text-gray-500">{pub.ratings}</span>
                          </div>
                        </div>
                      </div>

                      {/* Vibe bars */}
                      <div className="flex gap-1 mt-2">
                        {SLIDERS.map((s) => (
                          <div key={s.key} className="flex-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pub.vibe[s.key]}%`, background: s.color, opacity: 0.65 }}
                            />
                          </div>
                        ))}
                      </div>

                      {/* Chips */}
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {pub.chips.slice(0, 2).map((c) => (
                          <span key={c} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })
          )}

          {/* Rate button */}
          <div className="pt-2 pb-2">
            <button
              onClick={() => openRate()}
              className="w-full py-3 rounded-2xl border border-dashed border-gray-300 text-gray-500 text-[13px] hover:border-gray-400 hover:text-gray-700 transition-colors"
            >
              + Rate a place you've visited
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
