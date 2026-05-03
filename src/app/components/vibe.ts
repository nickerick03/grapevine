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
  { key: "modern",   left: "Classic",  right: "Modern",  color: "#F59E0B", bg: "bg-amber-50",   track: "from-amber-200 to-amber-500" },
  { key: "lively",   left: "Quiet",    right: "Lively",  color: "#EF4444", bg: "bg-red-50",     track: "from-red-200 to-red-500" },
  { key: "premium",  left: "Cheap",    right: "Premium", color: "#10B981", bg: "bg-emerald-50", track: "from-emerald-200 to-emerald-500" },
  { key: "touristy", left: "Local",    right: "Touristy",color: "#3B82F6", bg: "bg-blue-50",    track: "from-blue-200 to-blue-500" },
  { key: "spacious", left: "Cozy",     right: "Spacious",color: "#8B5CF6", bg: "bg-purple-50",  track: "from-purple-200 to-purple-500" },
];

export type VibeProfile = Record<SliderKey, number>;

export interface Pub {
  id: string;
  name: string;
  area: string;
  city: string;
  summary: string;
  chips: string[];
  match: number;
  ratings: number;
  vibe: VibeProfile;
  image: string;
  lat: number;
  lng: number;
}

export const PUBS: Pub[] = [
  {
    id: "1", name: "Szimpla Kert", area: "District VII", city: "Budapest",
    summary: "An iconic, buzzing ruin pub with a maze of mismatched rooms.",
    chips: ["lively", "retro", "local", "spacious", "good for groups"],
    match: 94, ratings: 482,
    vibe: { modern: 25, lively: 92, premium: 30, touristy: 70, spacious: 85 },
    image: "https://images.unsplash.com/photo-1514933651103-005eec06c04b?w=800",
    lat: 47.4979, lng: 19.0628,
  },
  {
    id: "2", name: "Csendes Vintage Bar", area: "District V", city: "Budapest",
    summary: "Cozy, eclectic spot perfect for slow conversation over wine.",
    chips: ["cozy", "retro", "good for talking", "intimate"],
    match: 89, ratings: 213,
    vibe: { modern: 35, lively: 30, premium: 55, touristy: 40, spacious: 25 },
    image: "https://images.unsplash.com/photo-1572116469696-31de0f17cc34?w=800",
    lat: 47.4925, lng: 19.0540,
  },
  {
    id: "3", name: "Kandalló Pub", area: "District VII", city: "Budapest",
    summary: "Warm, modern gastropub with great craft beer and a fireplace.",
    chips: ["cozy", "modern", "date night", "craft beer"],
    match: 86, ratings: 156,
    vibe: { modern: 70, lively: 50, premium: 65, touristy: 45, spacious: 40 },
    image: "https://images.unsplash.com/photo-1543007630-9710e4a00a20?w=800",
    lat: 47.4988, lng: 19.0591,
  },
  {
    id: "4", name: "Anker't", area: "District VI", city: "Budapest",
    summary: "Spacious open-air ruin pub, great for big groups on summer nights.",
    chips: ["spacious", "lively", "cheap", "outdoor"],
    match: 81, ratings: 327,
    vibe: { modern: 40, lively: 88, premium: 25, touristy: 60, spacious: 95 },
    image: "https://images.unsplash.com/photo-1538488881038-e252a119ace7?w=800",
    lat: 47.5034, lng: 19.0593,
  },
  {
    id: "5", name: "Mika Tivadar Mulató", area: "District VII", city: "Budapest",
    summary: "Stylish multi-level bar that gets lively after midnight.",
    chips: ["lively", "modern", "party start", "spacious"],
    match: 78, ratings: 198,
    vibe: { modern: 75, lively: 80, premium: 60, touristy: 55, spacious: 70 },
    image: "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=800",
    lat: 47.4972, lng: 19.0612,
  },
  {
    id: "6", name: "Kisüzem", area: "District VII", city: "Budapest",
    summary: "Hidden local favorite with cheap drinks and a relaxed crowd.",
    chips: ["cheap", "local", "hidden gem", "cozy"],
    match: 91, ratings: 142,
    vibe: { modern: 30, lively: 55, premium: 15, touristy: 20, spacious: 35 },
    image: "https://images.unsplash.com/photo-1466978913421-dad2ebd01d17?w=800",
    lat: 47.4998, lng: 19.0640,
  },
];

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