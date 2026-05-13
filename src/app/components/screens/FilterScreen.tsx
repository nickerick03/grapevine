import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { X, RotateCcw } from "lucide-react";
import {
  BeerStein,
  Coffee,
  ForkKnife,
  ChatCircle,
  CircleNotch,
  Coins,
  Heart,
  Diamond,
  Lightning,
  MusicNote,
  ArrowRight,
  HandHeart,
  Plus,
  X as PhX,
} from "@phosphor-icons/react";
import { SLIDERS, SliderDef, SliderKey } from "../vibe";
import { filterPubs, getAreasForCity, getCityCenter, haversineKm, radiusValueToKm } from "../filtering";
import { VibeSlider } from "../VibeSlider";
import { PRICE_OPTIONS, VENUE_TYPES, useFilters } from "../../context/FilterContext";
import { CustomPresetModal, getIconComponent } from "../CustomPresetModal";
import type { CustomPreset, VenueType } from "../../context/FilterContext";
import { usePlaces } from "../../context/PlacesContext";
import { formatDistance, type DistanceUnit, useSettings } from "../../context/SettingsContext";
import { searchOsmPlaces, toExternalPub } from "@/lib/services/osm";
import { directionalToLegacyScore, legacyScoreToDirectional } from "@/lib/vibe-scale";

const PRESET_ITEMS = [
  { key: "talking", label: "Good for talking", icon: <ChatCircle weight="duotone" size={22} /> },
  { key: "cheap",   label: "Cheap night out",  icon: <Coins weight="duotone" size={22} /> },
  { key: "date",    label: "Date night",       icon: <Heart weight="duotone" size={22} /> },
  { key: "hidden",  label: "Hidden gem",       icon: <Diamond weight="duotone" size={22} /> },
  { key: "party",   label: "Party start",      icon: <Lightning weight="duotone" size={22} /> },
  { key: "music",   label: "Live music",       icon: <MusicNote weight="duotone" size={22} /> },
];

const CITY_TO_COUNTRY: Record<string, string> = {
  Budapest: "Hungary",
  Vienna: "Austria",
  Berlin: "Germany",
  Prague: "Czechia",
  Lisbon: "Portugal",
};

const EXPLORE_MAP_STATE_KEY = "grapevine.explore.mapState.v1";
const LARGE_RADIUS_AUTOCENTER_KM = 10;

type PersistedExploreMapState = {
  center?: { lat: number; lng: number };
  bounds?: { north: number; south: number; east: number; west: number } | null;
  searchAreaRadiusKm?: number | null;
};

function computeRadiusFromBounds(
  bounds: { north: number; south: number; east: number; west: number },
  center: { lat: number; lng: number },
): number {
  const northSouth = haversineKm(bounds.north, center.lng, bounds.south, center.lng);
  const eastWest = haversineKm(center.lat, bounds.west, center.lat, bounds.east);
  const halfDiagonal = Math.sqrt((northSouth / 2) ** 2 + (eastWest / 2) ** 2);
  if (!Number.isFinite(halfDiagonal) || halfDiagonal <= 0) {
    return 6.5;
  }

  return Math.min(25, Math.max(0.8, halfDiagonal * 1.1));
}

// Convert 0–100 slider value → km label (∞ at 100)
function toKm(v: number, unit: DistanceUnit) {
  if (v >= 100) return "∞";
  const km = radiusValueToKm(v);
  return km < 2 ? formatDistance(km, unit, 1) : formatDistance(Math.round(km), unit, 0);
}

function SearchAreaMap({ radius, unit }: { radius: number; unit: DistanceUnit }) {
  const infinite = radius >= 100;
  // Scale the circle: 0→5, 99→44, 100=infinite (fill all)
  const r = infinite ? 999 : 5 + (radius / 99) * 40;

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-100 shadow-sm h-36 relative">
      {/* Map background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, #fef3e9 0%, transparent 45%), radial-gradient(circle at 70% 65%, #eaf2fb 0%, transparent 50%), linear-gradient(180deg, #f5f1ea 0%, #ecf1ec 100%)",
        }}
      />
      <svg
        className="absolute inset-0 w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        viewBox="0 0 100 60"
      >
        {/* Grid */}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 8} x2="100" y2={i * 8} stroke="#d8d2c5" strokeWidth="0.2" opacity="0.5" />
        ))}
        {Array.from({ length: 13 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 8} y1="0" x2={i * 8} y2="60" stroke="#d8d2c5" strokeWidth="0.2" opacity="0.5" />
        ))}
        {/* Roads */}
        <path d="M0,33 Q30,24 55,30 T100,27" stroke="#cfe0f5" strokeWidth="1.8" fill="none" />
        <path d="M12,0 Q15,18 21,33 T27,60" stroke="#dde6d3" strokeWidth="2" fill="none" opacity="0.6" />

        {/* Search radius — full rect when infinite, circle otherwise */}
        {infinite ? (
          <rect x="0" y="0" width="100" height="60" fill="#3B82F6" fillOpacity="0.06" />
        ) : (
          <circle
            cx="50"
            cy="30"
            r={r}
            fill="#3B82F6"
            fillOpacity="0.09"
            stroke="#3B82F6"
            strokeWidth="0.8"
            strokeDasharray="2 2"
          />
        )}

        {/* Pub dots — all highlighted when infinite */}
        {[
          { x: 44, y: 24 }, { x: 57, y: 32 }, { x: 38, y: 35 },
          { x: 62, y: 22 }, { x: 35, y: 26 }, { x: 53, y: 40 },
        ].map((p, i) => {
          const dist = Math.sqrt((p.x - 50) ** 2 + (p.y - 30) ** 2);
          const inside = infinite || dist <= r;
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="1.8"
              fill={inside ? "#1D4ED8" : "#9CA3AF"}
              opacity={inside ? 0.9 : 0.35}
            />
          );
        })}

        {/* User location dot */}
        <circle cx="50" cy="30" r="2.5" fill="#3B82F6" />
        <circle cx="50" cy="30" r="1.2" fill="white" />
      </svg>

      {/* Label */}
      <div className="absolute bottom-2 right-3 bg-white/90 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] border border-blue-100 shadow-sm"
        style={{ color: infinite ? "#7C3AED" : "#1D4ED8" }}>
        {infinite ? "No limit · all areas" : `${toKm(radius, unit)} radius`}
      </div>
      <div className="absolute top-2 left-3 text-[10px] text-gray-400">Search area</div>
    </div>
  );
}

export function FilterScreen() {
  const navigate = useNavigate();
  const { pubs } = usePlaces();
  const { distanceUnit, showTouristHeavyBars } = useSettings();
  const {
    values, setValues, enabled, setEnabled,
    selectedCity, setSelectedCity,
    selectedArea, setSelectedArea,
    margin, setMargin, marginEnabled, setMarginEnabled,
    searchRadius, setSearchRadius,
    venueTypes, setVenueTypes,
    price, setPrice,
    customPresets, addCustomPreset, removeCustomPreset,
  } = useFilters();

  const [modalOpen, setModalOpen] = useState(false);
  // Snapshot captured at the moment the user taps "Create Custom"
  const [snapValues,  setSnapValues]  = useState(values);
  const [snapEnabled, setSnapEnabled] = useState(enabled);
  const [snapMargin,  setSnapMargin]  = useState(margin);
  const [snapPrice,   setSnapPrice]   = useState(price);

  const [count, setCount] = useState(0);
  const [displayCount, setDisplayCount] = useState(0);
  const [countLoading, setCountLoading] = useState(false);
  const displayCountRef = useRef(0);
  const hasEnabledSliders = useMemo(() => SLIDERS.some((slider) => enabled[slider.key]), [enabled]);

  useEffect(() => {
    displayCountRef.current = displayCount;
  }, [displayCount]);

  useEffect(() => {
    const start = displayCountRef.current;
    const end = count;
    if (start === end) {
      return;
    }

    const durationMs = 260;
    const startedAt = performance.now();
    let frameId = 0;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const next = Math.round(start + (end - start) * progress);
      setDisplayCount(next);
      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [count]);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const persistedMapState = (() => {
      if (typeof window === "undefined") {
        return null;
      }

      try {
        const raw = window.sessionStorage.getItem(EXPLORE_MAP_STATE_KEY);
        if (!raw) {
          return null;
        }
        const parsed = JSON.parse(raw) as PersistedExploreMapState;
        if (!parsed.center || !Number.isFinite(parsed.center.lat) || !Number.isFinite(parsed.center.lng)) {
          return null;
        }
        return parsed;
      } catch {
        return null;
      }
    })();

    const persistedMapCenter = persistedMapState?.center ?? null;
    const persistedMapBounds = persistedMapState?.bounds ?? null;
    const center = persistedMapCenter ?? getCityCenter(selectedCity);
    const selectedCountry = CITY_TO_COUNTRY[selectedCity] ?? "Hungary";
    const venueTypeAreaMode = !hasEnabledSliders && price == null && venueTypes.length > 0;
    const viewportRadiusKm = persistedMapBounds ? computeRadiusFromBounds(persistedMapBounds, center) : null;
    const effectiveRadiusKm = venueTypeAreaMode && viewportRadiusKm != null
      ? viewportRadiusKm
      : radiusValueToKm(searchRadius);

    const activeFilters = {
      values,
      enabled,
      margin,
      marginEnabled,
      selectedCity,
      selectedArea,
      searchRadius,
      searchRadiusKmOverride: effectiveRadiusKm,
      venueTypes,
      price,
      showTouristHeavyBars,
      center,
    };

    const ratedCount = filterPubs(pubs, activeFilters).length;

    const computeCount = async () => {
      setCountLoading(true);
      if (hasEnabledSliders) {
        if (!cancelled) {
          setCount(ratedCount);
          setCountLoading(false);
        }
        return;
      }

      try {
        const radiusKm = Number.isFinite(effectiveRadiusKm) ? Math.min(Math.max(effectiveRadiusKm, 0.5), 25) : 25;
        const osmResults = await searchOsmPlaces({
          center,
          radiusKm,
          city: selectedCity,
          country: selectedCountry,
          signal: controller.signal,
        });

        if (cancelled) {
          return;
        }

        const ratedBySource = new Set(
          pubs
            .filter((pub) => pub.sourceProvider === "osm" && pub.sourcePlaceId)
            .map((pub) => pub.sourcePlaceId as string),
        );

        const unratedExternalPubs = osmResults
          .filter((place) => !ratedBySource.has(place.sourcePlaceId))
          .map(toExternalPub);

        const externalBaseFilters = {
          ...activeFilters,
          enabled: {
            modern: false,
            lively: false,
            premium: false,
            touristy: false,
            spacious: false,
          },
          margin: 100,
          marginEnabled: false,
        } as const;

        const externalCount = filterPubs(unratedExternalPubs, externalBaseFilters).length;
        setCount(ratedCount + externalCount);
      } catch (error) {
        if (!cancelled) {
          const isAbort = error instanceof DOMException && error.name === "AbortError";
          if (!isAbort) {
            setCount(ratedCount);
          }
        }
      } finally {
        if (!cancelled) {
          setCountLoading(false);
        }
      }
    };

    void computeCount();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [
    enabled,
    hasEnabledSliders,
    margin,
    marginEnabled,
    price,
    pubs,
    searchRadius,
    selectedArea,
    selectedCity,
    showTouristHeavyBars,
    values,
    venueTypes,
  ]);

  const areaOptions = useMemo(() => getAreasForCity(pubs, selectedCity), [pubs, selectedCity]);
  const cityOptions = useMemo(() => {
    const uniqueCities = Array.from(new Set(pubs.map((pub) => pub.city)));
    return uniqueCities.length > 0 ? uniqueCities : ["Budapest"];
  }, [pubs]);

  const reset = () => {
    setValues({ modern: 50, lively: 50, premium: 50, touristy: 50, spacious: 50 });
    setEnabled({ modern: false, lively: false, premium: false, touristy: false, spacious: false });
    setSelectedCity("Budapest");
    setSelectedArea("All areas");
    setMargin(20);
    setMarginEnabled(true);
    setSearchRadius(25);
    setVenueTypes(VENUE_TYPES);
    setPrice(null);
  };

  const applyPreset = (key: string) => {
    if (key === "talking") { setEnabled({ modern: false, lively: true, premium: false, touristy: true, spacious: false }); setValues({ ...values, lively: 25, touristy: 20 }); }
    if (key === "cheap")   { setEnabled({ modern: false, lively: false, premium: true, touristy: false, spacious: false }); setValues({ ...values, premium: 15 }); }
    if (key === "date")    { setEnabled({ modern: false, lively: true, premium: true, touristy: false, spacious: true }); setValues({ ...values, lively: 35, premium: 65, spacious: 30 }); }
    if (key === "hidden")  { setEnabled({ modern: false, lively: false, premium: false, touristy: true, spacious: false }); setValues({ ...values, touristy: 15 }); }
    if (key === "party")   { setEnabled({ modern: false, lively: true, premium: false, touristy: false, spacious: true }); setValues({ ...values, lively: 90, spacious: 75 }); }
    if (key === "music")   { setEnabled({ modern: true, lively: true, premium: false, touristy: false, spacious: false }); setValues({ ...values, modern: 60, lively: 75 }); }
  };

  const applyCustomPreset = (p: CustomPreset) => {
    setValues(p.values);
    setEnabled(p.enabled);
    setMargin(p.margin);
    setMarginEnabled(true);
    setVenueTypes(p.venueTypes ?? []);
    setPrice(p.price ?? null);
  };

  const openModal = () => {
    // Capture current filter state right now
    setSnapValues({ ...values });
    setSnapEnabled({ ...enabled });
    setSnapMargin(margin);
    setSnapPrice(price);
    setModalOpen(true);
  };

  const TOLERANCE_OPTIONS = [
    { label: "Flexible", value: 40 },
    { label: "Low",      value: 20 },
    { label: "High",     value: 10 },
    { label: "Exact",    value: 3  },
  ];

  const RADIUS_SLIDER: SliderDef = {
    key: "touristy" as SliderKey,
    left: formatDistance(0.5, distanceUnit, 1),
    right: "∞",
    color: "#3B82F6",
    bg: "bg-blue-50",
    track: "from-blue-200 to-blue-500",
  };

  const toggleVenueType = (type: VenueType) => {
    setVenueTypes(
      venueTypes.includes(type)
        ? venueTypes.filter((entry) => entry !== type)
        : [...venueTypes, type],
    );
  };

  const venueTypeLabel = (type: VenueType) => {
    if (type === "bar") return "Bar";
    if (type === "cafe") return "Cafe";
    return "Restaurant";
  };

  const venueTypeIcon = (type: VenueType) => {
    if (type === "bar") return <BeerStein weight="duotone" size={17} />;
    if (type === "cafe") return <Coffee weight="duotone" size={17} />;
    return <ForkKnife weight="duotone" size={17} />;
  };

  const handleShowPlaces = () => {
    const effectiveSearchRadiusKm = radiusValueToKm(searchRadius);
    const shouldFocusBestMatch =
      hasEnabledSliders &&
      count > 0 &&
      (searchRadius >= 100 || effectiveSearchRadiusKm >= LARGE_RADIUS_AUTOCENTER_KM);

    if (typeof window !== "undefined") {
      const venueTypeAreaMode = !hasEnabledSliders && price == null && venueTypes.length > 0;
      if (venueTypeAreaMode) {
        try {
          const raw = window.sessionStorage.getItem(EXPLORE_MAP_STATE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as PersistedExploreMapState;
            const center = parsed.center;
            const bounds = parsed.bounds ?? null;
            if (center && Number.isFinite(center.lat) && Number.isFinite(center.lng) && bounds) {
              const nextState: PersistedExploreMapState = {
                ...parsed,
                center,
                bounds,
                searchAreaRadiusKm: computeRadiusFromBounds(bounds, center),
              };
              window.sessionStorage.setItem(EXPLORE_MAP_STATE_KEY, JSON.stringify(nextState));
            }
          }
        } catch {
          // no-op: fall back to normal navigation
        }
      }
    }
    navigate("/", {
      state: {
        focusBestMatchFromFilter: shouldFocusBestMatch,
        focusToken: Date.now(),
      },
    });
  };

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 pt-3 pb-2 border-b border-gray-100 bg-white/70 backdrop-blur">
        <button onClick={reset} className="text-[13px] text-gray-600 flex items-center gap-1">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
        <div className="text-gray-900 text-[16px]">Filters</div>
        <button
          onClick={() => navigate("/")}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-32">

        {/* 1. Venue type */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Venue type</div>
          <div className="grid grid-cols-3 gap-2">
            {VENUE_TYPES.map((type) => {
              const active = venueTypes.includes(type);
              return (
                <button
                  key={type}
                  onClick={() => toggleVenueType(type)}
                  className={`py-2 rounded-xl text-[13px] border transition-colors flex items-center justify-center gap-1.5 ${
                    active
                      ? "bg-gray-900 text-white border-gray-900"
                      : "bg-white text-gray-600 border-gray-200 hover:border-gray-300 active:bg-gray-50"
                  }`}
                >
                  {venueTypeIcon(type)}
                  {venueTypeLabel(type)}
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Premade filters */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Premade filters</div>
          <div className="relative">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {customPresets.map((cp) => {
                const Icon = getIconComponent(cp.iconName);
                return (
                  <div
                    key={cp.id}
                    onClick={() => applyCustomPreset(cp)}
                    className="snap-start shrink-0 min-w-[150px] relative text-left px-3 py-2.5 rounded-2xl bg-white border border-gray-200 hover:border-gray-300 active:bg-gray-50 transition-colors group cursor-pointer select-none"
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); removeCustomPreset(cp.id); }}
                      className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center opacity-80 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 transition-opacity"
                    >
                      <PhX size={10} weight="bold" className="text-gray-500" />
                    </button>
                    <div className="text-gray-600">
                      <Icon weight="duotone" size={22} />
                    </div>
                    <div className="text-[13px] mt-1 text-gray-800 pr-4 truncate">{cp.name}</div>
                  </div>
                );
              })}

              {PRESET_ITEMS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => applyPreset(p.key)}
                  className="snap-start shrink-0 min-w-[150px] text-left px-3 py-2.5 rounded-2xl bg-white border border-gray-200 hover:border-gray-300 active:bg-gray-50 transition-colors"
                >
                  <div className="text-gray-600">{p.icon}</div>
                  <div className="text-[13px] mt-1 text-gray-800">{p.label}</div>
                </button>
              ))}

              <button
                onClick={openModal}
                className="snap-start shrink-0 min-w-[150px] text-left px-3 py-2.5 rounded-2xl bg-white border-2 border-dashed border-gray-300 hover:border-gray-400 active:bg-gray-50 transition-colors flex flex-col justify-center items-start gap-1"
              >
                <div className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center">
                  <Plus size={16} weight="bold" className="text-gray-500" />
                </div>
                <div className="text-[13px] text-gray-500">Create custom</div>
              </button>
            </div>
          </div>
        </div>

        {/* 3. Trait sliders */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Trait sliders</div>
          <div className="space-y-2">
            {SLIDERS.map((s) => (
              <VibeSlider
                key={s.key}
                def={s}
                value={legacyScoreToDirectional(values[s.key])}
                onChange={(v) => setValues({ ...values, [s.key]: directionalToLegacyScore(v) })}
                enabled={enabled[s.key]}
                onToggle={(b) => setEnabled({ ...enabled, [s.key]: b })}
                toggleWithDot
                scaleMode="centered"
              />
            ))}
          </div>
        </div>

        {/* 4. Price range */}
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

        {/* 5. Match tolerance */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Match tolerance</div>
          <div className="grid grid-cols-4 gap-2">
            {TOLERANCE_OPTIONS.map((opt) => {
              const active = margin === opt.value;
              return (
                <button
                  key={opt.label}
                  onClick={() => { setMargin(opt.value); setMarginEnabled(true); }}
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

        {/* 6. Find similar */}
        <button
          onClick={() => navigate("/similar")}
          className="w-full py-3 rounded-2xl bg-white border border-gray-200 text-gray-800 text-[13px] flex items-center justify-center gap-2 hover:border-gray-300 transition-colors shadow-sm"
        >
          Find similar places to a pub I like
          <ArrowRight size={15} className="text-gray-500" />
        </button>

        {/* 7. Location — moved above range selector */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Location</div>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={selectedCity}
              onChange={(event) => {
                const nextCity = event.target.value;
                setSelectedCity(nextCity);
                setSelectedArea("All areas");
              }}
              className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-[13px]"
            >
              {cityOptions.map((city) => <option key={city}>{city}</option>)}
            </select>
            <select
              value={selectedArea}
              onChange={(event) => setSelectedArea(event.target.value)}
              className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-[13px]"
            >
              {areaOptions.map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* 8. Search area radius */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] text-gray-500 uppercase tracking-wide">Search radius</div>
            <span
              className="text-[12px] transition-colors"
              style={{ color: searchRadius >= 100 ? "#7C3AED" : "#2563EB" }}
            >
              {toKm(searchRadius, distanceUnit)}
            </span>
          </div>
          <VibeSlider
            def={RADIUS_SLIDER}
            value={searchRadius}
            onChange={(v) => setSearchRadius(v)}
          />
          <div className="mt-3">
            <SearchAreaMap radius={searchRadius} unit={distanceUnit} />
          </div>
        </div>

        {/* Donation */}
        <div className="text-center">
          <button className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
            <HandHeart size={15} weight="duotone" />
            <span className="underline decoration-dotted underline-offset-2">Support Grapevine with a donation</span>
          </button>
        </div>
      </div>

      {/* Apply */}
      <div className="flex-none p-4 border-t border-gray-100 bg-white/90 backdrop-blur">
        <button
          onClick={handleShowPlaces}
          className="w-full py-3.5 rounded-2xl bg-gray-900 text-white shadow-md flex items-center justify-center gap-2"
        >
          {countLoading ? <CircleNotch size={16} weight="bold" className="animate-spin" /> : null}
          {countLoading ? "Searching " : "Show "}
          {displayCount} {displayCount === 1 ? "place" : "places"}
        </button>
      </div>

      <CustomPresetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={addCustomPreset}
        initialValues={snapValues}
        initialEnabled={snapEnabled}
        initialMargin={snapMargin}
        initialPrice={snapPrice}
      />
    </div>
  );
}
