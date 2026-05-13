import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check } from "lucide-react";
import {
  BeerStein,
  Wine,
  Martini,
  Coffee,
  Campfire,
  MusicNotes,
  Headphones,
  Guitar,
  Fire,
  Star,
  Moon,
  Trophy,
  GameController,
  Dog,
  Leaf,
  Mountains,
  Globe,
  Sparkle,
  Crown,
  DiceSix,
} from "@phosphor-icons/react";
import { SLIDERS, VibeProfile, SliderKey } from "./vibe";
import { VibeSlider } from "./VibeSlider";
import { CustomPreset, PRICE_OPTIONS } from "../context/FilterContext";
import { directionalToLegacyScore, legacyScoreToDirectional } from "@/lib/vibe-scale";

// ── 20 icon options ────────────────────────────────────────────────────────
export const ICON_OPTIONS = [
  { name: "BeerStein",    Icon: BeerStein },
  { name: "Wine",         Icon: Wine },
  { name: "Martini",      Icon: Martini },
  { name: "Coffee",       Icon: Coffee },
  { name: "Campfire",     Icon: Campfire },
  { name: "MusicNotes",   Icon: MusicNotes },
  { name: "Headphones",   Icon: Headphones },
  { name: "Guitar",       Icon: Guitar },
  { name: "Fire",         Icon: Fire },
  { name: "Star",         Icon: Star },
  { name: "Moon",         Icon: Moon },
  { name: "Trophy",       Icon: Trophy },
  { name: "GameController", Icon: GameController },
  { name: "Dog",          Icon: Dog },
  { name: "Leaf",         Icon: Leaf },
  { name: "Mountains",    Icon: Mountains },
  { name: "Globe",        Icon: Globe },
  { name: "Sparkle",      Icon: Sparkle },
  { name: "Crown",        Icon: Crown },
  { name: "DiceSix",      Icon: DiceSix },
] as const;

export type IconName = typeof ICON_OPTIONS[number]["name"];

export function getIconComponent(name: string) {
  return ICON_OPTIONS.find((o) => o.name === name)?.Icon ?? BeerStein;
}

// ── Tolerance options ──────────────────────────────────────────────────────
const TOLERANCE_OPTIONS = [
  { label: "Flexible", value: 40 },
  { label: "Low",      value: 20 },
  { label: "High",     value: 10 },
  { label: "Exact",    value: 3  },
];

// ── Props ──────────────────────────────────────────────────────────────────
interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (preset: CustomPreset) => void;
  /** Snapshot of filter state at the moment the user opened the modal */
  initialValues: VibeProfile;
  initialEnabled: Record<SliderKey, boolean>;
  initialMargin: number;
  initialPrice: 1 | 2 | 3 | 4 | null;
}

// ── Component ──────────────────────────────────────────────────────────────
export function CustomPresetModal({
  open,
  onClose,
  onSave,
  initialValues,
  initialEnabled,
  initialMargin,
  initialPrice,
}: Props) {
  const [name,        setName]        = useState("");
  const [iconName,    setIconName]    = useState<string>("BeerStein");
  const [values,      setValues]      = useState<VibeProfile>(initialValues);
  const [enabled,     setEnabled]     = useState<Record<SliderKey, boolean>>(initialEnabled);
  const [margin,      setMargin]      = useState(initialMargin);
  const [price,       setPrice]       = useState<1 | 2 | 3 | 4 | null>(initialPrice);
  const [nameError,   setNameError]   = useState(false);

  // Re-seed sliders every time the modal opens with the live filter state
  useEffect(() => {
    if (open) {
      setName("");
      setIconName("BeerStein");
      setValues(initialValues);
      setEnabled(initialEnabled);
      setMargin(initialMargin);
      setPrice(initialPrice);
      setNameError(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSave = () => {
    if (!name.trim()) { setNameError(true); return; }
    onSave({
      id: `custom-${Date.now()}`,
      name: name.trim(),
      iconName,
      values,
      enabled,
      margin,
      price,
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/40 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            className="absolute bottom-0 left-0 right-0 z-50 bg-[#fbf8f3] rounded-t-3xl overflow-hidden flex flex-col"
            style={{ maxHeight: "92%" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            {/* Drag handle */}
            <div className="flex-none flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Header */}
            <div className="flex-none flex items-center justify-between px-5 pb-3 pt-1 border-b border-gray-100">
              <div className="w-8" />
              <span className="text-gray-900">Create custom preset</span>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

              {/* 1. Name */}
              <div>
                <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Name</div>
                <input
                  type="text"
                  placeholder="e.g. Sunday afternoon…"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setNameError(false); }}
                  className={`w-full px-4 py-3 rounded-2xl bg-white border text-[14px] text-gray-800 placeholder-gray-400 outline-none transition-colors ${
                    nameError ? "border-red-400 bg-red-50" : "border-gray-200 focus:border-gray-400"
                  }`}
                />
                {nameError && (
                  <p className="text-[11px] text-red-500 mt-1 pl-1">Please enter a name for this preset.</p>
                )}
              </div>

              {/* 2. Trait sliders */}
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

              {/* 3. Price range */}
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

              {/* 4. Match tolerance */}
              <div>
                <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Match tolerance</div>
                <div className="grid grid-cols-4 gap-2">
                  {TOLERANCE_OPTIONS.map((opt) => {
                    const active = margin === opt.value;
                    return (
                      <button
                        key={opt.label}
                        onClick={() => setMargin(opt.value)}
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

              {/* 5. Icon picker */}
              <div>
                <div className="text-[12px] text-gray-500 uppercase tracking-wide mb-2">Icon</div>
                <div className="grid grid-cols-5 gap-2">
                  {ICON_OPTIONS.map(({ name: iName, Icon }) => {
                    const active = iconName === iName;
                    return (
                      <button
                        key={iName}
                        onClick={() => setIconName(iName)}
                        className={`aspect-square flex items-center justify-center rounded-2xl border-2 transition-all ${
                          active
                            ? "bg-gray-900 border-gray-900"
                            : "bg-white border-gray-200 hover:border-gray-300 active:scale-95"
                        }`}
                      >
                        <Icon
                          weight={active ? "fill" : "duotone"}
                          size={22}
                          className={active ? "text-white" : "text-gray-600"}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Bottom spacer so content clears the save button */}
              <div className="h-2" />
            </div>

            {/* Save button */}
            <div className="flex-none p-4 border-t border-gray-100 bg-white/90 backdrop-blur">
              <button
                onClick={handleSave}
                className="w-full py-3.5 rounded-2xl bg-gray-900 text-white shadow-md flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                <Check className="w-4 h-4" />
                Save preset
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
