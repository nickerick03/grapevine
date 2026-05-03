import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { X, RotateCcw } from "lucide-react";
import {
  ChatCircle,
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
import { SLIDERS, PUBS, CITIES, SliderDef, SliderKey } from "../vibe";
import { VibeSlider } from "../VibeSlider";
import { useFilters } from "../../context/FilterContext";
import { CustomPresetModal, getIconComponent } from "../CustomPresetModal";
import type { CustomPreset } from "../../context/FilterContext";

const PRESET_ITEMS = [
  { key: "talking", label: "Good for talking", icon: <ChatCircle weight="duotone" size={22} /> },
  { key: "cheap",   label: "Cheap night out",  icon: <Coins weight="duotone" size={22} /> },
  { key: "date",    label: "Date night",       icon: <Heart weight="duotone" size={22} /> },
  { key: "hidden",  label: "Hidden gem",       icon: <Diamond weight="duotone" size={22} /> },
  { key: "party",   label: "Party start",      icon: <Lightning weight="duotone" size={22} /> },
  { key: "music",   label: "Live music",       icon: <MusicNote weight="duotone" size={22} /> },
];

// Convert 0–100 slider value → km label (∞ at 100)
function toKm(v: number) {
  if (v >= 100) return "∞";
  const km = 0.5 + (v / 100) * 24.5; // 0→0.5km, 100→25km (capped before ∞)
  return km < 2 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

function SearchAreaMap({ radius }: { radius: number }) {
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
        {infinite ? "No limit · all areas" : `${toKm(radius)} radius`}
      </div>
      <div className="absolute top-2 left-3 text-[10px] text-gray-400">Search area</div>
    </div>
  );
}

export function FilterScreen() {
  const navigate = useNavigate();
  const {
    values, setValues, enabled, setEnabled,
    margin, setMargin, marginEnabled, setMarginEnabled,
    searchRadius, setSearchRadius,
    customPresets, addCustomPreset, removeCustomPreset,
  } = useFilters();

  const [modalOpen, setModalOpen] = useState(false);
  // Snapshot captured at the moment the user taps "Create Custom"
  const [snapValues,  setSnapValues]  = useState(values);
  const [snapEnabled, setSnapEnabled] = useState(enabled);
  const [snapMargin,  setSnapMargin]  = useState(margin);

  const count = useMemo(() => {
    const effectiveMargin = marginEnabled ? margin : 100;
    return PUBS.filter((p) =>
      SLIDERS.every((s) => !enabled[s.key] || Math.abs(p.vibe[s.key] - values[s.key]) <= effectiveMargin)
    ).length;
  }, [values, enabled, margin, marginEnabled]);

  const reset = () => {
    setValues({ modern: 50, lively: 50, premium: 50, touristy: 50, spacious: 50 });
    setEnabled({ modern: false, lively: false, premium: false, touristy: false, spacious: false });
    setMargin(20);
    setMarginEnabled(true);
    setSearchRadius(25);
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
  };

  const openModal = () => {
    // Capture current filter state right now
    setSnapValues({ ...values });
    setSnapEnabled({ ...enabled });
    setSnapMargin(margin);
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
    left: "0.5 km",
    right: "∞",
    color: "#3B82F6",
    bg: "bg-blue-50",
    track: "from-blue-200 to-blue-500",
  };

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-white/70 backdrop-blur">
        <button onClick={reset} className="text-[13px] text-gray-600 flex items-center gap-1">
          <RotateCcw className="w-3.5 h-3.5" /> Reset
        </button>
        <div className="text-gray-900">Filters</div>
        <button
          onClick={() => navigate("/")}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5 pb-32">

        {/* 1. Vibe sliders */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Vibe sliders</div>
          <div className="space-y-2">
            {SLIDERS.map((s) => (
              <VibeSlider
                key={s.key}
                def={s}
                value={values[s.key]}
                onChange={(v) => setValues({ ...values, [s.key]: v })}
                enabled={enabled[s.key]}
                onToggle={(b) => setEnabled({ ...enabled, [s.key]: b })}
                showToggle
              />
            ))}
          </div>
        </div>

        {/* 2. Match tolerance */}
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

        {/* 3. Good for */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Good for…</div>
          <div className="grid grid-cols-2 gap-2">
            {PRESET_ITEMS.map((p) => (
              <button
                key={p.key}
                onClick={() => applyPreset(p.key)}
                className="text-left px-3 py-3 rounded-2xl bg-white border border-gray-200 hover:border-gray-300 active:bg-gray-50 transition-colors"
              >
                <div className="text-gray-600">{p.icon}</div>
                <div className="text-[13px] mt-1 text-gray-800">{p.label}</div>
              </button>
            ))}

            {/* Custom presets */}
            {customPresets.map((cp) => {
              const Icon = getIconComponent(cp.iconName);
              return (
                <div
                  key={cp.id}
                  onClick={() => applyCustomPreset(cp)}
                  className="relative text-left px-3 py-3 rounded-2xl bg-white border border-gray-200 hover:border-gray-300 active:bg-gray-50 transition-colors group cursor-pointer select-none"
                >
                  {/* Delete button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); removeCustomPreset(cp.id); }}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
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

            {/* Create Custom button */}
            <button
              onClick={openModal}
              className="text-left px-3 py-3 rounded-2xl bg-white border-2 border-dashed border-gray-300 hover:border-gray-400 active:bg-gray-50 transition-colors flex flex-col justify-center items-start gap-1"
            >
              <div className="w-7 h-7 rounded-xl bg-gray-100 flex items-center justify-center">
                <Plus size={16} weight="bold" className="text-gray-500" />
              </div>
              <div className="text-[13px] text-gray-500">Create custom</div>
            </button>
          </div>
        </div>

        {/* 4. Find similar */}
        <button
          onClick={() => navigate("/similar")}
          className="w-full py-3 rounded-2xl bg-white border border-gray-200 text-gray-800 text-[13px] flex items-center justify-center gap-2 hover:border-gray-300 transition-colors shadow-sm"
        >
          Find similar places to a pub I like
          <ArrowRight size={15} className="text-gray-500" />
        </button>

        {/* 5. Location — moved above range selector */}
        <div>
          <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Location</div>
          <div className="grid grid-cols-2 gap-2">
            <select className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-[13px]">
              {CITIES.map((c) => <option key={c}>{c}</option>)}
            </select>
            <select className="px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-[13px]">
              {["All areas", "District V", "District VI", "District VII"].map((a) => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {/* 6. Search area radius */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[12px] text-gray-500 uppercase tracking-wide">Search radius</div>
            <span
              className="text-[12px] transition-colors"
              style={{ color: searchRadius >= 100 ? "#7C3AED" : "#2563EB" }}
            >
              {toKm(searchRadius)}
            </span>
          </div>
          <VibeSlider
            def={RADIUS_SLIDER}
            value={searchRadius}
            onChange={(v) => setSearchRadius(v)}
          />
          <div className="mt-3">
            <SearchAreaMap radius={searchRadius} />
          </div>
        </div>

        {/* Donation */}
        <div className="text-center">
          <button className="inline-flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-gray-700 transition-colors">
            <HandHeart size={15} weight="duotone" />
            <span className="underline decoration-dotted underline-offset-2">Support VibeMap with a donation</span>
          </button>
        </div>
      </div>

      {/* Apply */}
      <div className="flex-none p-4 border-t border-gray-100 bg-white/90 backdrop-blur">
        <button
          onClick={() => navigate("/")}
          className="w-full py-3.5 rounded-2xl bg-gray-900 text-white shadow-md flex items-center justify-center gap-2"
        >
          Show {count} {count === 1 ? "place" : "places"}
        </button>
      </div>

      <CustomPresetModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={addCustomPreset}
        initialValues={snapValues}
        initialEnabled={snapEnabled}
        initialMargin={snapMargin}
      />
    </div>
  );
}