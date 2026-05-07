import type { PlaceVibeSummary } from "@/types/place";

export const EXTREME_LOW = 20;
export const EXTREME_HIGH = 80;

export type TraitAxis =
  | "classic_modern"
  | "quiet_lively"
  | "cheap_premium"
  | "local_touristy"
  | "cozy_spacious";

export type TraitSide = "low" | "high";

export interface TraitCondition {
  axis: TraitAxis;
  side: TraitSide;
}

export interface TraitPillDefinition {
  slug: string;
  label: string;
  description: string;
  conditions: TraitCondition[];
}

const TRAIT_LABELS: Record<TraitAxis, { low: string; high: string }> = {
  classic_modern: { low: "Classic", high: "Modern" },
  quiet_lively: { low: "Quiet", high: "Lively" },
  cheap_premium: { low: "Indie", high: "Mainstream" },
  local_touristy: { low: "Local", high: "Touristy" },
  cozy_spacious: { low: "Cozy", high: "Spacious" },
};

export const TRAIT_PILL_DEFINITIONS: TraitPillDefinition[] = [
  {
    slug: "hidden-gem",
    label: "hidden gem",
    description: "Very local and very lively.",
    conditions: [
      { axis: "local_touristy", side: "low" },
      { axis: "quiet_lively", side: "high" },
    ],
  },
  {
    slug: "mothership",
    label: "mothership",
    description: "Very modern and very spacious.",
    conditions: [
      { axis: "classic_modern", side: "high" },
      { axis: "cozy_spacious", side: "high" },
    ],
  },
  {
    slug: "neon-hub",
    label: "neon hub",
    description: "Very modern, very lively, and very mainstream.",
    conditions: [
      { axis: "classic_modern", side: "high" },
      { axis: "quiet_lively", side: "high" },
      { axis: "cheap_premium", side: "high" },
    ],
  },
  {
    slug: "soft-spoken-nook",
    label: "soft-spoken nook",
    description: "Very quiet and very cozy.",
    conditions: [
      { axis: "quiet_lively", side: "low" },
      { axis: "cozy_spacious", side: "low" },
    ],
  },
  {
    slug: "old-soul-local",
    label: "old-soul local",
    description: "Very classic and very local.",
    conditions: [
      { axis: "classic_modern", side: "low" },
      { axis: "local_touristy", side: "low" },
    ],
  },
  {
    slug: "conversation-cellar",
    label: "conversation cellar",
    description: "Very quiet, very classic, and very cozy.",
    conditions: [
      { axis: "quiet_lively", side: "low" },
      { axis: "classic_modern", side: "low" },
      { axis: "cozy_spacious", side: "low" },
    ],
  },
  {
    slug: "indie-refuge",
    label: "indie refuge",
    description: "Very indie, very local, and very quiet.",
    conditions: [
      { axis: "cheap_premium", side: "low" },
      { axis: "local_touristy", side: "low" },
      { axis: "quiet_lively", side: "low" },
    ],
  },
  {
    slug: "backstreet-pulse",
    label: "backstreet pulse",
    description: "Very local, very lively, and very indie.",
    conditions: [
      { axis: "local_touristy", side: "low" },
      { axis: "quiet_lively", side: "high" },
      { axis: "cheap_premium", side: "low" },
    ],
  },
  {
    slug: "night-engine",
    label: "night engine",
    description: "Very modern and very lively.",
    conditions: [
      { axis: "classic_modern", side: "high" },
      { axis: "quiet_lively", side: "high" },
    ],
  },
  {
    slug: "open-social-floor",
    label: "open social floor",
    description: "Very spacious and very lively.",
    conditions: [
      { axis: "cozy_spacious", side: "high" },
      { axis: "quiet_lively", side: "high" },
    ],
  },
  {
    slug: "global-hotspot",
    label: "global hotspot",
    description: "Very touristy, very mainstream, and very lively.",
    conditions: [
      { axis: "local_touristy", side: "high" },
      { axis: "cheap_premium", side: "high" },
      { axis: "quiet_lively", side: "high" },
    ],
  },
  {
    slug: "welcome-lobby",
    label: "welcome lobby",
    description: "Very touristy and very spacious.",
    conditions: [
      { axis: "local_touristy", side: "high" },
      { axis: "cozy_spacious", side: "high" },
    ],
  },
  {
    slug: "postcard-classic",
    label: "postcard classic",
    description: "Very classic and very touristy.",
    conditions: [
      { axis: "classic_modern", side: "low" },
      { axis: "local_touristy", side: "high" },
    ],
  },
  {
    slug: "atlas-lounge",
    label: "atlas lounge",
    description: "Very touristy and very modern.",
    conditions: [
      { axis: "local_touristy", side: "high" },
      { axis: "classic_modern", side: "high" },
    ],
  },
  {
    slug: "polished-stage",
    label: "polished stage",
    description: "Very modern and very mainstream.",
    conditions: [
      { axis: "classic_modern", side: "high" },
      { axis: "cheap_premium", side: "high" },
    ],
  },
  {
    slug: "quiet-lux",
    label: "quiet lux",
    description: "Very quiet and very mainstream.",
    conditions: [
      { axis: "quiet_lively", side: "low" },
      { axis: "cheap_premium", side: "high" },
    ],
  },
  {
    slug: "date-cocoon",
    label: "date cocoon",
    description: "Very cozy, very quiet, and very mainstream.",
    conditions: [
      { axis: "cozy_spacious", side: "low" },
      { axis: "quiet_lively", side: "low" },
      { axis: "cheap_premium", side: "high" },
    ],
  },
  {
    slug: "creative-studio",
    label: "creative studio",
    description: "Very indie and very modern.",
    conditions: [
      { axis: "cheap_premium", side: "low" },
      { axis: "classic_modern", side: "high" },
    ],
  },
  {
    slug: "community-table",
    label: "community table",
    description: "Very local, very indie, and very spacious.",
    conditions: [
      { axis: "local_touristy", side: "low" },
      { axis: "cheap_premium", side: "low" },
      { axis: "cozy_spacious", side: "high" },
    ],
  },
  {
    slug: "analog-den",
    label: "analog den",
    description: "Very classic, very indie, and very cozy.",
    conditions: [
      { axis: "classic_modern", side: "low" },
      { axis: "cheap_premium", side: "low" },
      { axis: "cozy_spacious", side: "low" },
    ],
  },
  {
    slug: "zen-loft",
    label: "zen loft",
    description: "Very quiet, very modern, and very spacious.",
    conditions: [
      { axis: "quiet_lively", side: "low" },
      { axis: "classic_modern", side: "high" },
      { axis: "cozy_spacious", side: "high" },
    ],
  },
  {
    slug: "corner-crowd",
    label: "corner crowd",
    description: "Very cozy and very lively.",
    conditions: [
      { axis: "cozy_spacious", side: "low" },
      { axis: "quiet_lively", side: "high" },
    ],
  },
  {
    slug: "landmark-hall",
    label: "landmark hall",
    description: "Very spacious, very mainstream, and very touristy.",
    conditions: [
      { axis: "cozy_spacious", side: "high" },
      { axis: "cheap_premium", side: "high" },
      { axis: "local_touristy", side: "high" },
    ],
  },
];

function getAxisValue(summary: PlaceVibeSummary, axis: TraitAxis): number | null {
  switch (axis) {
    case "classic_modern":
      return summary.avg_classic_modern;
    case "quiet_lively":
      return summary.avg_quiet_lively;
    case "cheap_premium":
      return summary.avg_cheap_premium;
    case "local_touristy":
      return summary.avg_local_touristy;
    case "cozy_spacious":
      return summary.avg_cozy_spacious;
    default:
      return null;
  }
}

function conditionMatches(value: number | null, side: TraitSide): boolean {
  if (value === null) {
    return false;
  }

  if (side === "low") {
    return value <= EXTREME_LOW;
  }

  return value >= EXTREME_HIGH;
}

function conditionStrength(value: number | null, side: TraitSide): number {
  if (!conditionMatches(value, side) || value === null) {
    return 0;
  }

  if (side === "low") {
    const normalized = (EXTREME_LOW - value) / EXTREME_LOW;
    return 0.15 + Math.max(0, Math.min(1, normalized)) * 0.85;
  }

  const normalized = (value - EXTREME_HIGH) / (100 - EXTREME_HIGH);
  return 0.15 + Math.max(0, Math.min(1, normalized)) * 0.85;
}

function definitionScore(summary: PlaceVibeSummary, definition: TraitPillDefinition): number {
  const strengths = definition.conditions.map((condition) =>
    conditionStrength(getAxisValue(summary, condition.axis), condition.side),
  );
  const averageStrength = strengths.reduce((acc, value) => acc + value, 0) / Math.max(1, strengths.length);
  return averageStrength + definition.conditions.length * 0.08;
}

export function getTraitPillBySlug(slug: string): TraitPillDefinition | undefined {
  const normalizedSlug = slug.trim().toLowerCase();
  return TRAIT_PILL_DEFINITIONS.find((definition) => definition.slug === normalizedSlug);
}

export function getTraitPillByLabel(label: string): TraitPillDefinition | undefined {
  const normalizedLabel = label.trim().toLowerCase();
  return TRAIT_PILL_DEFINITIONS.find((definition) => definition.label === normalizedLabel);
}

export function getTraitPillSlug(label: string): string {
  return getTraitPillByLabel(label)?.slug ?? label.trim().toLowerCase().replace(/\s+/g, "-");
}

export function describeTraitCondition(condition: TraitCondition): string {
  const axis = TRAIT_LABELS[condition.axis];
  return condition.side === "low"
    ? `${axis.low} ≤ ${EXTREME_LOW}`
    : `${axis.high} ≥ ${EXTREME_HIGH}`;
}

export function generatePlaceChips(summary: PlaceVibeSummary): string[] {
  if (!summary.rating_count) {
    return [];
  }

  const matchingDefinitions = TRAIT_PILL_DEFINITIONS
    .filter((definition) =>
      definition.conditions.every((condition) => conditionMatches(getAxisValue(summary, condition.axis), condition.side)),
    )
    .map((definition) => ({
      definition,
      score: definitionScore(summary, definition),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((entry) => entry.definition.label);

  return matchingDefinitions;
}
