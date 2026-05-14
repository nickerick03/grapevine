export type SliderKey = "modern" | "lively" | "premium" | "touristy" | "spacious";

export interface SliderDef {
  key: SliderKey;
  left: string;
  right: string;
  color: string;
  bg: string;
  track: string;
}

export const SLIDERS: SliderDef[] = [
  { key: "modern",   left: "Vintage",  right: "Modern",  color: "#F59E0B", bg: "bg-amber-50",   track: "from-amber-200 to-amber-500" },
  { key: "lively",   left: "Quiet",    right: "Lively",  color: "#EF4444", bg: "bg-red-50",     track: "from-red-200 to-red-500" },
  { key: "premium",  left: "Indie",    right: "Casual", color: "#10B981", bg: "bg-emerald-50", track: "from-emerald-200 to-emerald-500" },
  { key: "touristy", left: "Local",    right: "Touristy",color: "#3B82F6", bg: "bg-blue-50",    track: "from-blue-200 to-blue-500" },
  { key: "spacious", left: "Cozy",     right: "Spacious",color: "#8B5CF6", bg: "bg-purple-50",  track: "from-purple-200 to-purple-500" },
];

export type VibeProfile = Record<SliderKey, number>;

export interface Pub {
  id: string;
  slug?: string;
  category?: string;
  venueType?: "bar" | "cafe" | "restaurant";
  priceRange?: 1 | 2 | 3 | 4 | null;
  address?: string;
  country?: string;
  sourceProvider?: string;
  sourcePlaceId?: string;
  isExternalCandidate?: boolean;
  openingHours?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  name: string;
  area: string;
  city: string;
  summary: string;
  chips: string[];
  match: number;
  perfectMatch?: boolean;
  ratings: number;
  vibe: VibeProfile;
  image: string;
  lat: number;
  lng: number;
}

export const CITIES = ["Budapest", "Berlin", "Lisbon", "Prague", "Vienna"];

export const QUICK_CHIPS = [
  "cozy","cheap","retro","lively","local","spacious","good for talking","good for dates",
];

export const PRESETS = [
  { key: "talking", label: "Good for talking", emoji: "💬" },
  { key: "cheap",   label: "Cheap night out",  emoji: "💸" },
  { key: "date",    label: "Date night",       emoji: "💝" },
  { key: "hidden",  label: "Hidden gem",       emoji: "💎" },
  { key: "party",   label: "Party start",      emoji: "🎉" },
  { key: "music",   label: "Live music",       emoji: "🎵" },
];
