import type { PlaceRatingRecord, PlaceVibeSummary, VibeFieldKey, VibeValues } from "@/types/place";

export function scoreFromSummary(summary: PlaceVibeSummary, key: VibeFieldKey): number {
  switch (key) {
    case "classic_modern":
      return summary.avg_classic_modern ?? 50;
    case "quiet_lively":
      return summary.avg_quiet_lively ?? 50;
    case "cheap_premium":
      return summary.avg_cheap_premium ?? 50;
    case "local_touristy":
      return summary.avg_local_touristy ?? 50;
    case "cozy_spacious":
      return summary.avg_cozy_spacious ?? 50;
  }
}

export function vibeValuesFromSummary(summary: PlaceVibeSummary): VibeValues {
  return {
    classic_modern: scoreFromSummary(summary, "classic_modern"),
    quiet_lively: scoreFromSummary(summary, "quiet_lively"),
    cheap_premium: scoreFromSummary(summary, "cheap_premium"),
    local_touristy: scoreFromSummary(summary, "local_touristy"),
    cozy_spacious: scoreFromSummary(summary, "cozy_spacious"),
  };
}

export function vibeValuesFromRating(rating: PlaceRatingRecord): VibeValues {
  return {
    classic_modern: rating.classic_modern,
    quiet_lively: rating.quiet_lively,
    cheap_premium: rating.cheap_premium,
    local_touristy: rating.local_touristy,
    cozy_spacious: rating.cozy_spacious,
  };
}
