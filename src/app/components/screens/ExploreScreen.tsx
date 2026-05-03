import { useState, useMemo, useRef } from "react";
import { useNavigate } from "react-router";
import { Search, SlidersHorizontal, User, Plus } from "lucide-react";
import { Crosshair } from "@phosphor-icons/react";
import { PUBS, SLIDERS } from "../vibe";
import { PubCard } from "../PubCard";
import { MapView } from "../MapView";
import { BottomNav } from "../BottomNav";
import { useAuth } from "../../context/AuthContext";
import { useFilters } from "../../context/FilterContext";
import { useUI } from "../../context/UIContext";
import { AppLogo } from "../AppLogo";
import { AdUnit } from "../AdUnit";

export function ExploreScreen() {
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();
  const { values, enabled } = useFilters();
  const { openRate } = useUI();

  const [view, setView] = useState<"map" | "list">("map");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | undefined>(PUBS[0].id);
  const [located, setLocated] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);

  const filtered = useMemo(() => {
    return PUBS.filter((p) => {
      if (
        query &&
        !p.name.toLowerCase().includes(query.toLowerCase()) &&
        !p.chips.some((c) => c.includes(query.toLowerCase()))
      )
        return false;
      return true;
    });
  }, [query]);

  const selectedPub = filtered.find((p) => p.id === selected) ?? filtered[0];

  const handleTouchEnd = () => {
    const deltaY = startY.current - currentY.current;
    if (deltaY > 80) setView("list");
  };

  const handleUserButton = () => {
    if (user) navigate("/profile");
    else openAuthModal();
  };

  const handleLocate = () => {
    setLocated(true);
    setTimeout(() => setLocated(false), 2500);
  };

  const hasActiveFilters = SLIDERS.some((s) => enabled[s.key]);

  // Heights: BottomNav = 60px, bottom sheet max = 35%
  // Floating buttons sit 12px above sheet top at max expansion
  // bottom = 35% + 60px (nav) + 12px gap
  const floatingBottom = "calc(35% + 72px)";

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      {/* Top bar */}
      <div className="flex-none px-4 pt-3 pb-2 bg-gradient-to-b from-[#fbf8f3] via-[#fbf8f3]/95 to-transparent z-20">
        <div className="flex items-center gap-2">
          {/* Logo */}
          <div className="flex-none">
            <AppLogo />
          </div>

          {/* Search bar */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pubs or vibe…"
              className="w-full pl-9 pr-10 py-2 rounded-full bg-white border border-gray-200 shadow-sm text-[13px] outline-none focus:border-gray-300"
            />
            <button
              onClick={() => navigate("/filter")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-gray-600" />
            </button>
          </div>

          {/* User button */}
          <button
            onClick={handleUserButton}
            className="w-9 h-9 rounded-full bg-white border border-gray-200 shadow-sm flex items-center justify-center flex-none overflow-hidden"
          >
            {user ? (
              <div
                className="w-full h-full flex items-center justify-center text-white text-[11px]"
                style={{ background: `linear-gradient(135deg, ${user.gradientFrom}, ${user.gradientTo})` }}
              >
                {user.initials}
              </div>
            ) : (
              <User className="w-4 h-4 text-gray-700" />
            )}
          </button>
        </div>

        {/* Active filter strip — tappable */}
        {hasActiveFilters && (
          <button
            onClick={() => navigate("/filter")}
            className="w-full mt-3 pt-3 border-t border-gray-200/70 px-1 text-left"
          >
            <div className="flex gap-1">
              {SLIDERS.map((s) => {
                const isOn = enabled[s.key];
                return (
                  <div key={s.key} className="flex-1 h-1.5 rounded-full bg-gray-200/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: isOn ? `${values[s.key]}%` : "50%",
                        background: isOn ? s.color : "#d1d5db",
                        opacity: isOn ? 1 : 0.35,
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1 mt-[1px]">
              {SLIDERS.map((s) => {
                const isOn = enabled[s.key];
                const label = values[s.key] > 50 ? s.right : s.left;
                return (
                  <div key={s.key} className="flex-1 text-center overflow-hidden">
                    <span className="text-[8px] leading-none" style={{ color: isOn ? s.color : "#d1d5db" }}>
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 relative">
        {view === "map" ? (
          <>
            <MapView pubs={filtered} selected={selected} onSelect={setSelected} located={located} />

            {/* Floating row: Rate + Locate — inline, centred above bottom sheet */}
            <div
              className="absolute left-0 right-0 z-20 flex items-center justify-center"
              style={{ bottom: floatingBottom }}
            >
              {/* Rate button — truly centred */}
              <button
                onClick={() => openRate(selectedPub?.id)}
                className="px-5 py-2.5 rounded-full bg-white border border-gray-200 text-gray-800 shadow-md text-[13px] flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" /> Rate this place
              </button>

              {/* Locate button — right edge, same row */}
              <button
                onClick={handleLocate}
                className={`absolute right-4 w-10 h-10 rounded-full shadow-md border flex items-center justify-center transition-all duration-300 flex-none ${
                  located
                    ? "bg-blue-500 border-blue-400 text-white scale-95"
                    : "bg-white border-gray-200 text-gray-700"
                }`}
                title="Locate me"
              >
                <Crosshair
                  weight={located ? "fill" : "regular"}
                  size={18}
                  className={located ? "animate-pulse" : ""}
                />
              </button>
            </div>

            {/* Bottom sheet — sits above BottomNav (bottom-[60px]) */}
            <div
              ref={sheetRef}
              onTouchStart={(e) => { startY.current = e.touches[0].clientY; }}
              onTouchMove={(e) => { currentY.current = e.touches[0].clientY; }}
              onTouchEnd={handleTouchEnd}
              className="absolute left-0 right-0 bg-white rounded-t-3xl shadow-[0_-8px_32px_rgba(0,0,0,0.08)] border-t border-gray-100 max-h-[35%] overflow-hidden flex flex-col"
              style={{ bottom: "60px" }}
            >
              <div className="flex justify-center pt-2 pb-1 cursor-grab active:cursor-grabbing">
                <div className="w-10 h-1 rounded-full bg-gray-300" />
              </div>
              <div className="pb-1 flex justify-center">
                <div className="text-[13px] text-gray-400">{filtered.length} results</div>
              </div>
              <div className="overflow-y-auto px-3 py-2 space-y-2 pb-3">
                {selectedPub && (
                  <PubCard
                    pub={selectedPub}
                    onClick={() => navigate(`/detail/${selectedPub.id}`)}
                    selected
                  />
                )}
                {filtered
                  .filter((p) => p.id !== selectedPub?.id)
                  .slice(0, 3)
                  .map((p) => (
                    <PubCard
                      key={p.id}
                      pub={p}
                      onClick={() => setSelected(p.id)}
                      compact
                    />
                  ))}
              </div>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 overflow-y-auto px-3 py-3 space-y-2 pb-[76px] bg-[#fbf8f3]">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="text-[14px] text-gray-900">{filtered.length} pubs nearby</div>
              <button
                onClick={() => setView("map")}
                className="text-[12px] text-gray-600 px-3 py-1.5 rounded-full bg-white border border-gray-200"
              >
                ← Back to map
              </button>
            </div>
            {filtered.map((p, i) => {
              const isSearching = query.trim().length > 0;
              // Search results: show ad after 2nd result
              const showSearchAd = isSearching && i === 2;
              // List view: show ad after every 3rd card (when not searching)
              const showListAd = !isSearching && i > 0 && i % 3 === 0;

              return (
                <div key={p.id}>
                  {showSearchAd && (
                    <AdUnit variant="native" index={1} className="mb-2" />
                  )}
                  <PubCard pub={p} onClick={() => navigate(`/detail/${p.id}`)} />
                  {showListAd && (
                    <AdUnit variant="native" index={Math.floor(i / 3)} className="mt-2" />
                  )}
                </div>
              );
            })}
            {!filtered.length && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-3">🍺</div>
                <div className="text-gray-900">No matches yet</div>
                <div className="text-[13px] text-gray-500 mt-1">Try fewer filters or adjust vibe sliders</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <BottomNav />
    </div>
  );
}