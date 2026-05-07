import type { PlaceRecord, PlaceVibeSummary } from "@/types/place";

export interface SimilarPlaceCandidate {
  place: PlaceRecord;
  summary: PlaceVibeSummary;
  distance: number;
}

export function calculateVibeDistance(a: PlaceVibeSummary, b: PlaceVibeSummary): number {
  const aModern = a.avg_classic_modern ?? 50;
  const bModern = b.avg_classic_modern ?? 50;
  const aLively = a.avg_quiet_lively ?? 50;
  const bLively = b.avg_quiet_lively ?? 50;
  const aPremium = a.avg_cheap_premium ?? 50;
  const bPremium = b.avg_cheap_premium ?? 50;
  const aTouristy = a.avg_local_touristy ?? 50;
  const bTouristy = b.avg_local_touristy ?? 50;
  const aSpacious = a.avg_cozy_spacious ?? 50;
  const bSpacious = b.avg_cozy_spacious ?? 50;

  return Math.sqrt(
    (aModern - bModern) ** 2 +
      (aLively - bLively) ** 2 +
      (aPremium - bPremium) ** 2 +
      (aTouristy - bTouristy) ** 2 +
      (aSpacious - bSpacious) ** 2,
  );
}

export function rankSimilarPlaces(
  targetPlace: PlaceRecord,
  targetSummary: PlaceVibeSummary,
  allPlaces: PlaceRecord[],
  summaryByPlaceId: Map<string, PlaceVibeSummary>,
  limit = 4,
): SimilarPlaceCandidate[] {
  const scored = allPlaces
    .filter((place) => place.id !== targetPlace.id)
    .map((place) => {
      const summary = summaryByPlaceId.get(place.id);
      const fallbackSummary: PlaceVibeSummary =
        summary ??
        ({
          place_id: place.id,
          rating_count: 0,
          avg_classic_modern: null,
          avg_quiet_lively: null,
          avg_cheap_premium: null,
          avg_local_touristy: null,
          avg_cozy_spacious: null,
          confidence_level: "No ratings yet",
        } as PlaceVibeSummary);

      const distance = calculateVibeDistance(targetSummary, fallbackSummary);

      return {
        place,
        summary: fallbackSummary,
        distance,
      };
    })
    .sort((a, b) => {
      const cityPriorityA = a.place.city === targetPlace.city ? 0 : 1;
      const cityPriorityB = b.place.city === targetPlace.city ? 0 : 1;

      if (cityPriorityA !== cityPriorityB) {
        return cityPriorityA - cityPriorityB;
      }

      const categoryPriorityA = a.place.category === targetPlace.category ? 0 : 1;
      const categoryPriorityB = b.place.category === targetPlace.category ? 0 : 1;

      if (categoryPriorityA !== categoryPriorityB) {
        return categoryPriorityA - categoryPriorityB;
      }

      return a.distance - b.distance;
    });

  return scored.slice(0, limit);
}
