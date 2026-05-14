import type { VibeFieldKey } from "@/types/place";

export interface VibeDimension {
  key: VibeFieldKey;
  dbAverageKey:
    | "avg_classic_modern"
    | "avg_quiet_lively"
    | "avg_cheap_premium"
    | "avg_local_touristy"
    | "avg_cozy_spacious";
  label: string;
  leftLabel: string;
  rightLabel: string;
  color: string;
  softBackground: string;
}

export const DEFAULT_CITY = "Budapest";

export const DEFAULT_BUDAPEST_CENTER = {
  lat: 47.4979,
  lng: 19.0402,
};

export const VIBE_DIMENSIONS: VibeDimension[] = [
  {
    key: "classic_modern",
    dbAverageKey: "avg_classic_modern",
    label: "Vintage vs Modern",
    leftLabel: "Vintage",
    rightLabel: "Modern",
    color: "#F59E0B",
    softBackground: "#FFFBEB",
  },
  {
    key: "quiet_lively",
    dbAverageKey: "avg_quiet_lively",
    label: "Quiet vs Lively",
    leftLabel: "Quiet",
    rightLabel: "Lively",
    color: "#EF4444",
    softBackground: "#FEF2F2",
  },
  {
    key: "cheap_premium",
    dbAverageKey: "avg_cheap_premium",
    label: "Cheap vs Premium",
    leftLabel: "Cheap",
    rightLabel: "Premium",
    color: "#10B981",
    softBackground: "#ECFDF5",
  },
  {
    key: "local_touristy",
    dbAverageKey: "avg_local_touristy",
    label: "Local vs Touristy",
    leftLabel: "Local",
    rightLabel: "Touristy",
    color: "#3B82F6",
    softBackground: "#EFF6FF",
  },
  {
    key: "cozy_spacious",
    dbAverageKey: "avg_cozy_spacious",
    label: "Cozy vs Spacious",
    leftLabel: "Cozy",
    rightLabel: "Spacious",
    color: "#8B5CF6",
    softBackground: "#F5F3FF",
  },
];

export const PLACE_CATEGORIES = [
  "bar",
  "pub",
  "cocktail bar",
  "wine bar",
  "cafe",
  "club",
  "restaurant",
  "gallery",
  "coworking",
  "park",
] as const;
