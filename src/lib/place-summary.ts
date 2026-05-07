import type { PlaceRecord, PlaceVibeSummary } from "@/types/place";

export function buildEmptySummary(placeOrPlaceId: PlaceRecord | string): PlaceVibeSummary {
  const placeId = typeof placeOrPlaceId === "string" ? placeOrPlaceId : placeOrPlaceId.id;

  return {
    place_id: placeId,
    rating_count: 0,
    avg_classic_modern: null,
    avg_quiet_lively: null,
    avg_cheap_premium: null,
    avg_local_touristy: null,
    avg_cozy_spacious: null,
    avg_price_range: null,
    confidence_level: "No ratings yet",
  };
}
