import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  ArrowRight,
  MapPin,
  Image as ImageIcon,
  Clock,
  Phone,
  Globe,
  Check,
  X,
  Plus,
  Storefront,
  Tag,
  Star,
} from "@phosphor-icons/react";
import { SLIDERS, QUICK_CHIPS, type Pub } from "../vibe";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { usePlaces } from "../../context/PlacesContext";
import { formatDistance, type DistanceUnit, useSettings } from "../../context/SettingsContext";
import { formatPubAddress } from "../placeAddress";

// ─── Mock distances ───────────────────────────────────────────────────────────

const MOCK_DISTANCES: Record<string, number> = {
  "1": 0.3,
  "6": 0.4,
  "2": 0.5,
  "3": 0.7,
  "5": 0.9,
  "4": 1.1,
};

// ─── Step indicator ──────────────────────────────────────────────────────────

function StepDot({ active, done }: { active: boolean; done: boolean }) {
  return (
    <div
      className={`w-2 h-2 rounded-full transition-all ${
        done
          ? "bg-gray-900"
          : active
          ? "bg-gray-900 scale-125"
          : "bg-gray-300"
      }`}
    />
  );
}

// ─── Step 1 — Pin on map ─────────────────────────────────────────────────────

function PinMapStep({
  pin,
  onPin,
}: {
  pin: { x: number; y: number } | null;
  onPin: (pos: { x: number; y: number }) => void;
}) {
  const mapRef = useRef<HTMLDivElement>(null);

  const handleTap = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = mapRef.current!.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      onPin({ x, y });
    },
    [onPin]
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      <div>
        <p className="text-[14px] text-gray-500 mt-1">
          Tap on the map to drop a pin where your place is located.
        </p>
      </div>

      {/* Map canvas */}
      <div
        ref={mapRef}
        onClick={handleTap}
        className="relative flex-1 rounded-3xl overflow-hidden cursor-crosshair border-2 border-dashed border-gray-200 active:border-gray-400 transition-colors"
        style={{
          background:
            "radial-gradient(circle at 30% 20%, #fef3e9 0%, transparent 40%), radial-gradient(circle at 70% 60%, #eaf2fb 0%, transparent 50%), linear-gradient(180deg, #f5f1ea 0%, #ecf1ec 100%)",
          minHeight: 280,
        }}
      >
        {/* Grid lines */}
        <svg
          className="absolute inset-0 w-full h-full opacity-40 pointer-events-none"
          preserveAspectRatio="none"
          viewBox="0 0 100 100"
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={`h${i}`}
              x1="0"
              y1={i * 8}
              x2="100"
              y2={i * 8}
              stroke="#d8d2c5"
              strokeWidth="0.15"
            />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <line
              key={`v${i}`}
              x1={i * 8}
              y1="0"
              x2={i * 8}
              y2="100"
              stroke="#d8d2c5"
              strokeWidth="0.15"
            />
          ))}
          <path
            d="M0,55 Q30,40 55,50 T100,45"
            stroke="#cfe0f5"
            strokeWidth="2.5"
            fill="none"
          />
          <path
            d="M20,0 Q25,30 35,55 T45,100"
            stroke="#dde6d3"
            strokeWidth="3"
            fill="none"
            opacity="0.6"
          />
        </svg>

        {/* Dropped pin */}
        {pin && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${pin.x}%`,
              top: `${pin.y}%`,
              transform: "translate(-50%, -100%)",
            }}
          >
            <div className="relative animate-bounce">
              <div className="w-8 h-8 rounded-full bg-red-500 border-2 border-white shadow-lg flex items-center justify-center">
                <MapPin weight="fill" size={16} className="text-white" />
              </div>
              <div className="w-2 h-2 bg-red-500 rotate-45 absolute left-1/2 -translate-x-1/2 -bottom-1 shadow-sm" />
            </div>
          </div>
        )}

        {/* Hint overlay when no pin */}
        {!pin && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-white/80 backdrop-blur rounded-2xl px-4 py-3 flex items-center gap-2 shadow-sm">
              <MapPin size={16} className="text-red-500" />
              <span className="text-[13px] text-gray-600">Tap to place pin</span>
            </div>
          </div>
        )}
      </div>

      {pin && (
        <div className="bg-red-50 border border-red-100 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center flex-none">
            <MapPin weight="fill" size={14} className="text-white" />
          </div>
          <div>
            <div className="text-[13px] text-gray-800">Pin placed</div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Coordinates: {(47.488 + (pin.y / 100) * 0.02).toFixed(4)}°N,{" "}
              {(19.05 + (pin.x / 100) * 0.02).toFixed(4)}°E
            </div>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPin({ x: pin.x, y: pin.y });
            }}
            className="ml-auto text-[11px] text-red-500 underline"
          >
            Move
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Step 2 — Basic info + image ─────────────────────────────────────────────

function BasicInfoStep({
  existingPubs,
  distanceUnit,
  data,
  onChange,
}: {
  existingPubs: Pub[];
  distanceUnit: DistanceUnit;
  data: {
    name: string;
    area: string;
    city: string;
    description: string;
    image: string | null;
    chips: string[];
  };
  onChange: (patch: Partial<typeof data>) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const searchResults = useMemo(() => {
    const q = data.name.trim().toLowerCase();
    if (!q) return [];
    return existingPubs.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.area.toLowerCase().includes(q)
    ).slice(0, 5);
  }, [data.name, existingPubs]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    onChange({ image: url });
  };

  const toggleChip = (chip: string) => {
    const next = data.chips.includes(chip)
      ? data.chips.filter((c) => c !== chip)
      : [...data.chips, chip];
    onChange({ chips: next });
  };

  const selectPub = (pub: Pub) => {
    onChange({ name: pub.name, area: pub.area, city: pub.city });
    setDropdownOpen(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Image upload */}
      <div>
        <label className="text-[12px] text-gray-500 mb-1.5 block">
          Cover photo
        </label>
        <div
          onClick={() => fileRef.current?.click()}
          className="relative w-full h-40 rounded-2xl overflow-hidden border-2 border-dashed border-gray-200 cursor-pointer hover:border-gray-400 transition-colors bg-gray-50 flex items-center justify-center"
        >
          {data.image ? (
            <>
              <img
                src={data.image}
                alt="preview"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                <div className="bg-white/90 rounded-xl px-3 py-1.5 flex items-center gap-1.5 text-[12px] text-gray-700">
                  <ImageIcon size={14} /> Change photo
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <ImageIcon size={22} className="text-gray-400" />
              </div>
              <span className="text-[13px]">Tap to upload photo</span>
            </div>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />
      </div>

      {/* Name with search dropdown */}
      <div>
        <label className="text-[12px] text-gray-500 mb-1.5 block">
          Place name *
        </label>
        <div ref={dropdownRef} className="relative">
          <Storefront
            size={16}
            className="absolute left-3 top-[14px] text-gray-400 z-10 pointer-events-none"
          />
          <input
            value={data.name}
            onChange={(e) => {
              onChange({ name: e.target.value });
              setDropdownOpen(true);
            }}
            onFocus={() => data.name.trim() && setDropdownOpen(true)}
            placeholder="e.g. The Golden Hops"
            className="w-full pl-9 pr-4 py-3 rounded-2xl border border-gray-200 bg-white text-[14px] text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors"
          />

          {/* Dropdown */}
          {dropdownOpen && searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white rounded-2xl border border-gray-200 shadow-[0_8px_30px_rgba(0,0,0,0.10)] overflow-hidden">
              <div className="px-3 pt-2 pb-1">
                <span className="text-[11px] text-gray-400 uppercase tracking-wide">
                  Existing places
                </span>
              </div>
              <div className="divide-y divide-gray-50">
                {searchResults.map((pub) => {
                  const dist = MOCK_DISTANCES[pub.id] ?? null;
                  return (
                    <button
                      key={pub.id}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => selectPub(pub)}
                      className="w-full text-left flex gap-0 overflow-hidden hover:bg-gray-50 active:bg-gray-100 transition-colors"
                    >
                      {/* Thumbnail */}
                      <div className="relative w-20 h-[72px] flex-none">
                        <ImageWithFallback
                          src={pub.image}
                          alt={pub.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Content */}
                      <div className="flex-1 px-3 py-2.5 min-w-0">
                        {/* Row 1: name + right stats */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[13px] text-gray-900 truncate leading-tight">
                              {pub.name}
                            </div>
                            <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-0.5">
                              <MapPin size={9} weight="duotone" className="text-blue-400 flex-none" />
                              <span className="truncate">{formatPubAddress(pub)}</span>
                            </div>
                          </div>
                          <div className="flex-none text-right">
                            {dist !== null && (
                              <div className="text-[11px] text-blue-600 leading-tight">
                                {formatDistance(dist, distanceUnit, 1)}
                              </div>
                            )}
                            <div className="flex items-center gap-0.5 justify-end mt-0.5">
                              <Star size={9} weight="fill" className="text-amber-400" />
                              <span className="text-[11px] text-gray-500">{pub.ratings}</span>
                            </div>
                          </div>
                        </div>

                        {/* Row 2: vibe bars + match % */}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="flex gap-1 flex-1">
                            {SLIDERS.map((s) => (
                              <div
                                key={s.key}
                                className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden"
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${pub.vibe[s.key]}%`,
                                    background: s.color,
                                    opacity: 0.7,
                                  }}
                                />
                              </div>
                            ))}
                          </div>
                          <span className="text-[12px] text-gray-700 flex-none">
                            {pub.match}%
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              <div className="px-3 py-2 border-t border-gray-50">
                <span className="text-[11px] text-gray-400">
                  Select to fill in details, or keep typing to add a new place
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Area + City */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[12px] text-gray-500 mb-1.5 block">
            Neighbourhood
          </label>
          <input
            value={data.area}
            onChange={(e) => onChange({ area: e.target.value })}
            placeholder="e.g. District VII"
            className="w-full px-3 py-3 rounded-2xl border border-gray-200 bg-white text-[13px] text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors"
          />
        </div>
        <div>
          <label className="text-[12px] text-gray-500 mb-1.5 block">
            City
          </label>
          <input
            value={data.city}
            onChange={(e) => onChange({ city: e.target.value })}
            placeholder="e.g. Budapest"
            className="w-full px-3 py-3 rounded-2xl border border-gray-200 bg-white text-[13px] text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="text-[12px] text-gray-500 mb-1.5 block">
          Short description
        </label>
        <textarea
          value={data.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder="Describe the place in one or two sentences…"
          rows={3}
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-[13px] text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors resize-none"
        />
      </div>

      {/* Place tags */}
      <div>
        <label className="text-[12px] text-gray-500 mb-1.5 flex items-center gap-1">
          <Tag size={12} /> Place tags
        </label>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CHIPS.map((chip) => {
            const active = data.chips.includes(chip);
            return (
              <button
                key={chip}
                onClick={() => toggleChip(chip)}
                className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
                  active
                    ? "bg-gray-900 text-white border-gray-900"
                    : "bg-white text-gray-600 border-gray-200"
                }`}
              >
                {chip}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Hours model ─────────────────────────────────────────────────────────────

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
type DayName = (typeof DAYS)[number];

interface DayHours {
  open: string;
  close: string;
  closed: boolean;
}

type HoursMap = Record<DayName, DayHours>;

const DEFAULT_HOURS: HoursMap = {
  Mon: { open: "16:00", close: "00:00", closed: false },
  Tue: { open: "16:00", close: "00:00", closed: false },
  Wed: { open: "16:00", close: "00:00", closed: false },
  Thu: { open: "16:00", close: "00:00", closed: false },
  Fri: { open: "16:00", close: "02:00", closed: false },
  Sat: { open: "16:00", close: "02:00", closed: false },
  Sun: { open: "16:00", close: "23:00", closed: true },
};

// ─── Step 3 — Opening hours & contact ────────────────────────────────────────

function HoursStep({
  hours,
  contact,
  onHours,
  onContact,
}: {
  hours: HoursMap;
  contact: { phone: string; website: string };
  onHours: (h: HoursMap) => void;
  onContact: (c: { phone: string; website: string }) => void;
}) {
  const updateDay = (day: DayName, patch: Partial<DayHours>) => {
    onHours({ ...hours, [day]: { ...hours[day], ...patch } });
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Opening hours */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={15} className="text-gray-500" />
          <span className="text-[13px] text-gray-700">Opening hours</span>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {DAYS.map((day, i) => (
            <div
              key={day}
              className={`flex items-center gap-2 px-4 py-3 ${
                i < DAYS.length - 1 ? "border-b border-gray-50" : ""
              }`}
            >
              {/* Day label */}
              <span className="text-[12px] text-gray-500 w-8">{day}</span>

              {/* Closed toggle */}
              <button
                onClick={() =>
                  updateDay(day, { closed: !hours[day].closed })
                }
                className={`flex-none w-8 h-5 rounded-full transition-colors relative ${
                  hours[day].closed ? "bg-gray-200" : "bg-gray-900"
                }`}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                    hours[day].closed ? "left-0.5" : "left-3.5"
                  }`}
                />
              </button>

              {hours[day].closed ? (
                <span className="text-[12px] text-gray-400 italic ml-2">
                  Closed
                </span>
              ) : (
                <div className="flex items-center gap-1.5 ml-1 flex-1">
                  <input
                    type="time"
                    value={hours[day].open}
                    onChange={(e) => updateDay(day, { open: e.target.value })}
                    className="flex-1 text-[12px] text-gray-700 border border-gray-200 rounded-xl px-2 py-1 outline-none focus:border-gray-400"
                  />
                  <span className="text-[11px] text-gray-400">–</span>
                  <input
                    type="time"
                    value={hours[day].close}
                    onChange={(e) => updateDay(day, { close: e.target.value })}
                    className="flex-1 text-[12px] text-gray-700 border border-gray-200 rounded-xl px-2 py-1 outline-none focus:border-gray-400"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Contact */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Phone size={15} className="text-gray-500" />
          <span className="text-[13px] text-gray-700">Contact (optional)</span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Phone
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={contact.phone}
              onChange={(e) =>
                onContact({ ...contact, phone: e.target.value })
              }
              placeholder="+36 1 000 0000"
              className="w-full pl-9 pr-4 py-3 rounded-2xl border border-gray-200 bg-white text-[13px] text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors"
            />
          </div>
          <div className="relative">
            <Globe
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={contact.website}
              onChange={(e) =>
                onContact({ ...contact, website: e.target.value })
              }
              placeholder="https://yourplace.com"
              className="w-full pl-9 pr-4 py-3 rounded-2xl border border-gray-200 bg-white text-[13px] text-gray-800 placeholder-gray-400 outline-none focus:border-gray-400 transition-colors"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step 4 — Vibe sliders ────────────────────────────────────────────────────

function VibeStep({
  vibe,
  onChange,
}: {
  vibe: Record<string, number>;
  onChange: (key: string, val: number) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[13px] text-gray-500">
        Set the profile of this place using the sliders below. Be honest — this
        helps others find it!
      </p>
      {SLIDERS.map((s) => (
        <div key={s.key} className={`rounded-2xl ${s.bg} p-4`}>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[12px] text-gray-500">{s.left}</span>
            <span
              className="text-[13px] px-3 py-0.5 rounded-full text-white"
              style={{ background: s.color }}
            >
              {vibe[s.key]}
            </span>
            <span className="text-[12px] text-gray-500">{s.right}</span>
          </div>
          <div className="relative h-2 rounded-full bg-gray-200">
            <div
              className="absolute left-0 top-0 h-full rounded-full transition-all"
              style={{
                width: `${vibe[s.key]}%`,
                background: `linear-gradient(90deg, ${s.color}66, ${s.color})`,
              }}
            />
            <input
              type="range"
              min={0}
              max={100}
              value={vibe[s.key]}
              onChange={(e) => onChange(s.key, Number(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-md transition-all"
              style={{
                left: `calc(${vibe[s.key]}% - 10px)`,
                background: s.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Success screen ───────────────────────────────────────────────────────────

function SuccessView({
  name,
  image,
  onDone,
}: {
  name: string;
  image: string | null;
  onDone: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 py-8 px-4 text-center">
      {image && (
        <div className="w-28 h-28 rounded-3xl overflow-hidden shadow-lg">
          <img src={image} alt={name} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="w-16 h-16 rounded-full bg-emerald-500 flex items-center justify-center shadow-lg">
        <Check size={32} weight="bold" className="text-white" />
      </div>
      <div>
        <div className="text-gray-900 text-[20px] mb-1">Place submitted!</div>
        <div className="text-[14px] text-gray-500 leading-relaxed max-w-xs">
          <span className="text-gray-800">{name || "Your place"}</span> has been
          submitted for review. It'll appear on the map once approved.
        </div>
      </div>
      <button
        onClick={onDone}
        className="mt-2 w-full max-w-xs py-3.5 rounded-2xl bg-gray-900 text-white text-[14px] shadow-lg"
      >
        Back to profile
      </button>
    </div>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

const STEP_LABELS = ["Location", "Details", "Hours", "Profile"];

export function AddPlaceScreen() {
  const navigate = useNavigate();
  const { pubs } = usePlaces();
  const { distanceUnit } = useSettings();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  // Step 1
  const [pin, setPin] = useState<{ x: number; y: number } | null>(null);

  // Step 2
  const [basicInfo, setBasicInfo] = useState({
    name: "",
    area: "",
    city: "Budapest",
    description: "",
    image: null as string | null,
    chips: [] as string[],
  });

  // Step 3
  const [hours, setHours] = useState<HoursMap>(DEFAULT_HOURS);
  const [contact, setContact] = useState({ phone: "", website: "" });

  // Step 4
  const [vibe, setVibe] = useState<Record<string, number>>({
    modern: 50,
    lively: 50,
    premium: 50,
    touristy: 50,
    spacious: 50,
  });

  const canNext = () => {
    if (step === 0) return pin !== null;
    if (step === 1) return basicInfo.name.trim().length > 0;
    return true;
  };

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
    else setDone(true);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
    else navigate(-1);
  };

  if (done) {
    return (
      <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
        <div className="flex-none flex items-center justify-between px-4 pt-3 pb-2 bg-white/70 backdrop-blur border-b border-gray-100">
          <div className="w-9" />
          <div className="text-gray-900 text-[16px]">Add New Place</div>
          <div className="w-9" />
        </div>
        <SuccessView
          name={basicInfo.name}
          image={basicInfo.image}
          onDone={() => navigate("/profile")}
        />
      </div>
    );
  }

  return (
    <div className="absolute inset-0 flex flex-col bg-[#fbf8f3]">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 pt-3 pb-2 bg-white/70 backdrop-blur border-b border-gray-100 z-10">
        <button
          onClick={handleBack}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft size={16} className="text-gray-600" />
        </button>
        <div className="text-gray-900 text-[16px]">Add New Place</div>
        <button
          onClick={() => navigate("/profile")}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <X size={16} className="text-gray-600" />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex-none px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-3">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center gap-2 flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] border transition-all ${
                    i < step
                      ? "bg-gray-900 border-gray-900 text-white"
                      : i === step
                      ? "bg-white border-gray-900 text-gray-900"
                      : "bg-white border-gray-200 text-gray-400"
                  }`}
                >
                  {i < step ? <Check size={11} weight="bold" /> : i + 1}
                </div>
                <span
                  className={`text-[10px] ${
                    i <= step ? "text-gray-700" : "text-gray-400"
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`flex-1 h-px mb-4 transition-colors ${
                    i < step ? "bg-gray-900" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {step === 0 && (
          <PinMapStep pin={pin} onPin={setPin} />
        )}
        {step === 1 && (
          <BasicInfoStep
            existingPubs={pubs}
            distanceUnit={distanceUnit}
            data={basicInfo}
            onChange={(patch) => setBasicInfo((p) => ({ ...p, ...patch }))}
          />
        )}
        {step === 2 && (
          <HoursStep
            hours={hours}
            contact={contact}
            onHours={setHours}
            onContact={setContact}
          />
        )}
        {step === 3 && (
          <VibeStep
            vibe={vibe}
            onChange={(key, val) =>
              setVibe((prev) => ({ ...prev, [key]: val }))
            }
          />
        )}
      </div>

      {/* Bottom CTA */}
      <div className="flex-none px-4 pt-3 pb-8 bg-white/80 backdrop-blur border-t border-gray-100">
        <button
          onClick={handleNext}
          disabled={!canNext()}
          className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-[14px] transition-all shadow-sm ${
            canNext()
              ? "bg-gray-900 text-white active:scale-[0.98]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          {step < 3 ? (
            <>
              Continue <ArrowRight size={16} />
            </>
          ) : (
            <>
              <Plus size={16} /> Submit place
            </>
          )}
        </button>
      </div>
    </div>
  );
}
