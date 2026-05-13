import { useState, useRef, useCallback, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Check, Trash2 } from "lucide-react";
import {
  Camera,
  Image as ImageIcon,
  Sliders,
  Palette,
  UploadSimple,
  Smiley,
} from "@phosphor-icons/react";
import { useAuth } from "../../context/AuthContext";

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_UPLOAD_FILE_BYTES = 8 * 1024 * 1024;
const AVATAR_EXPORT_SIZE = 400;
const MAX_AVATAR_OUTPUT_BYTES = 220 * 1024;

/* ─── Filter presets ─────────────────────────────────────── */
interface FilterPreset {
  id: string;
  label: string;
  css: string;
}

const FILTER_PRESETS: FilterPreset[] = [
  { id: "none",   label: "Normal", css: "none" },
  { id: "warm",   label: "Warm",   css: "sepia(0.35) saturate(1.4) brightness(1.05)" },
  { id: "cool",   label: "Cool",   css: "hue-rotate(20deg) saturate(1.1) brightness(1.02)" },
  { id: "vivid",  label: "Vivid",  css: "saturate(1.8) contrast(1.1)" },
  { id: "fade",   label: "Fade",   css: "opacity(0.85) brightness(1.1) saturate(0.7)" },
  { id: "bw",     label: "B&W",    css: "grayscale(1) contrast(1.1)" },
  { id: "moody",  label: "Moody",  css: "brightness(0.85) contrast(1.2) saturate(0.8)" },
  { id: "golden", label: "Golden", css: "sepia(0.5) saturate(1.6) brightness(1.1) hue-rotate(-10deg)" },
];

/* ─── Gradient palettes ──────────────────────────────────── */
const GRADIENT_PALETTES = [
  { from: "#A3E635", to: "#15803D", label: "Ember"    },
  { from: "#EF4444", to: "#EC4899", label: "Rose"     },
  { from: "#C2410C", to: "#7C2D12", label: "Violet"   },
  { from: "#0F172A", to: "#1D4ED8", label: "Ocean"    },
  { from: "#3B82F6", to: "#8B5CF6", label: "Sapphire" },
  { from: "#F97316", to: "#EAB308", label: "Citrus"   },
  { from: "#06B6D4", to: "#10B981", label: "Mint"     },
  { from: "#EC4899", to: "#8B5CF6", label: "Candy"    },
  { from: "#374151", to: "#111827", label: "Slate"    },
];

/* ─── Emoji categories ───────────────────────────────────── */
const EMOJI_CATEGORIES = [
  {
    label: "Animals",
    emojis: ["🦊","🐻","🦁","🐯","🐺","🦝","🦉","🐧","🦋","🐉","🦸","🐸","🐼","🦄","🦩","🐬","🦅","🦔","🐙","🦀"],
  },
  {
    label: "Drinks & Food",
    emojis: ["🍺","🍻","🍷","🥂","🍸","🍹","🧉","☕","🫖","🥃","🍕","🌮","🍔","🍜","🧁","🍩","🍣","🧆","🫕","🍪"],
  },
  {
    label: "Vibes",
    emojis: ["🔥","✨","⭐","🌈","🌙","🌊","🎭","🎪","🎨","🎸","🎲","♟️","🎯","🏆","👑","💎","🔮","🪄","🗺️","🎩"],
  },
  {
    label: "Nature",
    emojis: ["🌸","🌺","🍀","🌿","🌻","🪐","🌵","🍄","🌴","🪨","🌾","🍁","🌍","🌞","❄️","🌊","⛰️","🌋","🏔️","🌅"],
  },
  {
    label: "People & Fun",
    emojis: ["🧙","🤖","👻","😎","🤠","🧐","🥳","😈","👽","🤡","🎅","🧜","🧚","🦸","🥷","🧑‍🚀","🧑‍🎤","🧑‍🍳","🕵️","🤺"],
  },
  {
    label: "Objects",
    emojis: ["🚀","✈️","🏠","🏰","🗽","⚓","🎠","🎡","🎢","🛸","🚂","🏍️","⛵","🎻","📚","🔭","🧭","🔑","🪬","🧲"],
  },
];

/* ─── Adjustment slider ──────────────────────────────────── */
function AdjustSlider({
  label, value, min, max, color, onChange, formatValue,
}: {
  label: string; value: number; min: number; max: number;
  color: string; onChange: (v: number) => void; formatValue?: (v: number) => string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-gray-500">{label}</span>
        <span className="text-[12px] text-gray-700">{formatValue ? formatValue(value) : value}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-gray-200">
        <div className="absolute left-0 top-0 h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
        <input
          type="range" min={min} max={max} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 shadow-md pointer-events-none transition-all"
          style={{ left: `calc(${pct}% - 8px)`, borderColor: color }}
        />
      </div>
    </div>
  );
}

/* ─── Main screen ────────────────────────────────────────── */
type Tab = "filters" | "adjust" | "color" | "icon";

export function PhotoEditScreen() {
  const navigate = useNavigate();
  const { user, saveUserPreferences } = useAuth();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  const [rawPhoto, setRawPhoto]         = useState<string | null>(user?.profilePhoto ?? null);
  const [selectedFilter, setFilter]     = useState<FilterPreset>(FILTER_PRESETS[0]);
  const [brightness, setBrightness]     = useState(100);
  const [contrast, setContrast]         = useState(100);
  const [saturation, setSaturation]     = useState(100);
  const [selectedGrad, setSelectedGrad] = useState({ from: user?.gradientFrom ?? "#F59E0B", to: user?.gradientTo ?? "#EF4444" });
  const [selectedEmoji, setSelectedEmoji] = useState<string>(user?.emoji ?? "🦊");
  const [tab, setTab]                   = useState<Tab>(rawPhoto ? "filters" : "color");
  const [saved, setSaved]               = useState(false);
  const [activeCat, setActiveCat]       = useState(0);
  const [saving, setSaving]             = useState(false);
  const [saveError, setSaveError]       = useState<string | null>(null);

  const cssFilter = useCallback(() => {
    const parts: string[] = [];
    if (brightness !== 100) parts.push(`brightness(${brightness / 100})`);
    if (contrast   !== 100) parts.push(`contrast(${contrast   / 100})`);
    if (saturation !== 100) parts.push(`saturate(${saturation / 100})`);
    if (selectedFilter.css !== "none") parts.push(selectedFilter.css);
    return parts.length ? parts.join(" ") : "none";
  }, [brightness, contrast, saturation, selectedFilter]);

  const dataUrlSizeBytes = useCallback((dataUrl: string): number => {
    const base64 = dataUrl.split(",")[1] ?? "";
    const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  }, []);

  const getEditedDataUrl = useCallback((): Promise<string | null> => {
    return new Promise((resolve) => {
      if (!rawPhoto) return resolve(null);
      const canvas = canvasRef.current!;
      const ctx = canvas.getContext("2d")!;
      const img = new Image();
      img.onload = () => {
        const size = AVATAR_EXPORT_SIZE;
        canvas.width = size; canvas.height = size;
        ctx.clearRect(0, 0, size, size);
        ctx.filter = cssFilter();
        const ratio = Math.max(size / img.width, size / img.height);
        const w = img.width * ratio, h = img.height * ratio;
        ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

        const encode = (quality: number) => canvas.toDataURL("image/jpeg", quality);
        const high = encode(0.86);
        if (dataUrlSizeBytes(high) <= MAX_AVATAR_OUTPUT_BYTES) {
          resolve(high);
          return;
        }

        const medium = encode(0.74);
        if (dataUrlSizeBytes(medium) <= MAX_AVATAR_OUTPUT_BYTES) {
          resolve(medium);
          return;
        }

        const low = encode(0.62);
        resolve(low);
      };
      img.src = rawPhoto;
    });
  }, [rawPhoto, cssFilter, dataUrlSizeBytes]);

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError(null);

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setSaveError("Unsupported file type. Please upload JPG, PNG, or WebP.");
      e.target.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_FILE_BYTES) {
      setSaveError("This file is too large. Please upload an image under 8 MB.");
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setRawPhoto(ev.target?.result as string);
      setTab("filters");
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSave = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    setSaving(true);
    setSaveError(null);

    const profilePhoto = rawPhoto ? await getEditedDataUrl() : undefined;
    if (profilePhoto && dataUrlSizeBytes(profilePhoto) > MAX_AVATAR_OUTPUT_BYTES) {
      setSaving(false);
      setSaveError("Could not compress this image enough. Please try a different photo.");
      return;
    }
    const { error } = await saveUserPreferences({
      username: user.username,
      city: user.city ?? "",
      hideScore: user.hideScore ?? false,
      showPublicNotes: user.showPublicNotes ?? true,
      emoji: selectedEmoji,
      gradientFrom: selectedGrad.from,
      gradientTo: selectedGrad.to,
      profilePhoto: profilePhoto ?? undefined,
    });

    setSaving(false);
    if (error) {
      setSaveError(error);
      return;
    }

    setSaved(true);
    setTimeout(() => navigate("/profile"), 600);
  };

  const handleRemove = () => {
    setRawPhoto(null);
    setTab("color");
  };

  useEffect(() => {
    if (!rawPhoto && (tab === "filters" || tab === "adjust")) setTab("color");
  }, [rawPhoto]);

  const previewFilter = cssFilter();

  const photoTabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "filters", label: "Filters", icon: <ImageIcon size={15} weight="duotone" /> },
    { id: "adjust",  label: "Adjust",  icon: <Sliders   size={15} weight="duotone" /> },
    { id: "color",   label: "Color",   icon: <Palette   size={15} weight="duotone" /> },
    { id: "icon",    label: "Icon",    icon: <Smiley    size={15} weight="duotone" /> },
  ];
  const noPhotoTabs = photoTabs.filter((t) => t.id === "color" || t.id === "icon");
  const visibleTabs = rawPhoto ? photoTabs : noPhotoTabs;

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur border-b border-gray-100 z-10">
        <button
          onClick={() => navigate("/profile")}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-gray-900">Edit Photo</span>
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] transition-all ${
            saved ? "bg-emerald-500 text-white" : "bg-gray-900 text-white active:scale-95"
          }`}
        >
          <Check className="w-3.5 h-3.5" />
          {saved ? "Saved!" : saving ? "Saving..." : "Save"}
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Preview ── */}
        <div className="flex flex-col items-center pt-8 pb-6 px-4">
          <div className="relative">
            <div className="w-36 h-36 rounded-full overflow-hidden shadow-xl ring-4 ring-white">
              {rawPhoto ? (
                <img
                  src={rawPhoto} alt="preview"
                  className="w-full h-full object-cover"
                  style={{ filter: previewFilter }}
                  draggable={false}
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${selectedGrad.from}, ${selectedGrad.to})` }}
                >
                  <span className="text-5xl">{selectedEmoji}</span>
                </div>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 w-10 h-10 rounded-full bg-gray-900 border-2 border-white flex items-center justify-center shadow-lg active:scale-90 transition-transform"
            >
              <Camera size={18} weight="fill" className="text-white" />
            </button>
          </div>

          <div className="flex items-center gap-2 mt-5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gray-900 text-white text-[13px] active:scale-95 transition-transform"
            >
              <UploadSimple size={14} weight="bold" />
              {rawPhoto ? "Change photo" : "Upload photo"}
            </button>
            {rawPhoto && (
              <button
                onClick={handleRemove}
                className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-red-50 border border-red-100 text-red-500 text-[13px] active:scale-95 transition-transform"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFilePick}
          />
          <canvas ref={canvasRef} className="hidden" />
        </div>

        {/* ── Tab bar ── */}
        <div className="px-4 mb-4">
          <div className="flex bg-white border border-gray-100 rounded-2xl p-1 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            {visibleTabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-xl text-[12px] transition-all ${
                  tab === t.id ? "bg-gray-900 text-white shadow" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          {saveError ? (
            <p className="mt-2 text-[12px] text-red-500 text-center">{saveError}</p>
          ) : null}
        </div>

        {/* ── Filters tab ── */}
        {tab === "filters" && rawPhoto && (
          <div className="px-4 pb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-4">
              <div className="text-[11px] text-gray-400 uppercase tracking-widest mb-3">Filter</div>
              <div className="grid grid-cols-4 gap-2">
                {FILTER_PRESETS.map((preset) => (
                  <button key={preset.id} onClick={() => setFilter(preset)} className="flex flex-col items-center gap-1.5">
                    <div className={`w-full aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      selectedFilter.id === preset.id ? "border-gray-900 shadow-md scale-105" : "border-transparent"
                    }`}>
                      <img src={rawPhoto} alt={preset.label} className="w-full h-full object-cover"
                        style={{ filter: preset.css === "none" ? "none" : preset.css }} draggable={false} />
                    </div>
                    <span className={`text-[10px] transition-colors ${selectedFilter.id === preset.id ? "text-gray-900" : "text-gray-400"}`}>
                      {preset.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Adjust tab ── */}
        {tab === "adjust" && rawPhoto && (
          <div className="px-4 pb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5 space-y-6">
              <div className="text-[11px] text-gray-400 uppercase tracking-widest">Adjustments</div>
              <AdjustSlider label="Brightness" value={brightness} min={50} max={150} color="#F59E0B"
                onChange={setBrightness} formatValue={(v) => `${v > 100 ? "+" : ""}${v - 100}`} />
              <AdjustSlider label="Contrast"   value={contrast}   min={50} max={150} color="#EF4444"
                onChange={setContrast}   formatValue={(v) => `${v > 100 ? "+" : ""}${v - 100}`} />
              <AdjustSlider label="Saturation" value={saturation} min={0}  max={200} color="#8B5CF6"
                onChange={setSaturation} formatValue={(v) => `${v > 100 ? "+" : ""}${v - 100}`} />
              <button
                onClick={() => { setBrightness(100); setContrast(100); setSaturation(100); }}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-500 text-[13px] hover:bg-gray-50 transition-colors"
              >
                Reset adjustments
              </button>
            </div>
          </div>
        )}

        {/* ── Color tab ── */}
        {tab === "color" && (
          <div className="px-4 pb-6">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] p-5">
              <div className="text-[11px] text-gray-400 uppercase tracking-widest mb-1">Avatar colour</div>
              <p className="text-[12px] text-gray-400 mb-4">Background gradient shown when no photo is set.</p>
              <div className="grid grid-cols-3 gap-3">
                {GRADIENT_PALETTES.map((g) => {
                  const isActive = selectedGrad.from === g.from && selectedGrad.to === g.to;
                  return (
                    <button
                      key={g.label}
                      onClick={() => setSelectedGrad({ from: g.from, to: g.to })}
                      className={`flex flex-col items-center gap-2 p-2 rounded-2xl border-2 transition-all ${
                        isActive ? "border-gray-900 shadow-md" : "border-transparent hover:border-gray-200"
                      }`}
                    >
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center shadow"
                        style={{ background: `linear-gradient(135deg, ${g.from}, ${g.to})` }}
                      >
                        <span className="text-2xl">{selectedEmoji}</span>
                      </div>
                      <span className="text-[11px] text-gray-500">{g.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── Icon tab ── */}
        {tab === "icon" && (
          <div className="px-4 pb-8">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_8px_rgba(0,0,0,0.04)] overflow-hidden">
              {/* Category pills */}
              <div className="px-4 pt-4 pb-0">
                <div className="text-[11px] text-gray-400 uppercase tracking-widest mb-3">Pick an icon</div>
                <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide">
                  {EMOJI_CATEGORIES.map((cat, i) => (
                    <button
                      key={cat.label}
                      onClick={() => setActiveCat(i)}
                      className={`flex-none px-3 py-1 rounded-full text-[11px] transition-all whitespace-nowrap ${
                        activeCat === i
                          ? "bg-gray-900 text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Emoji grid */}
              <div className="px-4 pb-4">
                <div className="grid grid-cols-6 gap-1">
                  {EMOJI_CATEGORIES[activeCat].emojis.map((em) => {
                    const isActive = selectedEmoji === em;
                    return (
                      <button
                        key={em}
                        onClick={() => setSelectedEmoji(em)}
                        className={`aspect-square flex items-center justify-center rounded-xl text-2xl transition-all ${
                          isActive
                            ? "bg-gray-900 shadow-md scale-110"
                            : "hover:bg-gray-100 active:scale-95"
                        }`}
                      >
                        {em}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Current selection */}
              <div className="mx-4 mb-4 p-3 rounded-xl bg-gray-50 flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shadow flex-none"
                  style={{ background: `linear-gradient(135deg, ${selectedGrad.from}, ${selectedGrad.to})` }}
                >
                  <span className="text-xl">{selectedEmoji}</span>
                </div>
                <div className="text-[12px] text-gray-500">
                  Your avatar will show <span className="text-gray-900">{selectedEmoji}</span> on your selected colour background.
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
