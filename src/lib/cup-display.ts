import type { PublicProfileCupPlacement } from "@/types/cup";

function formatDate(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatCupScore(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return "0";
  }

  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
}

export function formatCupPeriod(startAt: string | null, endAt: string | null, fallbackDate?: string | null): string {
  const start = formatDate(startAt);
  const end = formatDate(endAt);

  if (start && end) {
    return `${start} - ${end}`;
  }
  if (start) {
    return `${start} -`;
  }
  if (end) {
    return `- ${end}`;
  }

  return formatDate(fallbackDate ?? null) ?? "Dates unavailable";
}

export function getCupPlacementHeadline(placement: PublicProfileCupPlacement): string {
  if (placement.placement === 1) {
    return `Winner of ${placement.cupName}!`;
  }
  if (placement.placement === 2) {
    return `Second place in ${placement.cupName}`;
  }
  return `Third place in ${placement.cupName}`;
}

export function getCupPlacementPointsLine(placement: PublicProfileCupPlacement): string {
  if (placement.placement === 1) {
    return `Won with ${formatCupScore(placement.cupScore)} points`;
  }
  return `Finished with ${formatCupScore(placement.cupScore)} points`;
}

export function getCupPlacementEmoji(placement: 1 | 2 | 3): string {
  if (placement === 1) {
    return "🏆";
  }
  if (placement === 2) {
    return "🥈";
  }
  return "🥉";
}
