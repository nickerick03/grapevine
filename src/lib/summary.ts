import type { PlaceVibeSummary } from "@/types/place";
import { generatePlaceChips } from "./chips";

export function generatePlaceSummary(summary: PlaceVibeSummary): string {
  if (summary.rating_count === 0) {
    return "No ratings yet. Be the first to add your impression.";
  }

  const chips = generatePlaceChips(summary);
  const preferredOrder = [
    "hidden gem",
    "mothership",
    "neon hub",
    "soft-spoken nook",
    "old-soul local",
    "conversation cellar",
    "indie refuge",
    "backstreet pulse",
    "night engine",
    "open social floor",
    "global hotspot",
    "welcome lobby",
    "postcard classic",
    "atlas lounge",
    "polished stage",
    "quiet lux",
    "date cocoon",
    "creative studio",
    "community table",
    "analog den",
    "zen loft",
    "corner crowd",
    "landmark hall",
  ];

  const selected = preferredOrder.filter((chip) => chips.includes(chip)).slice(0, 4);

  if (selected.length === 0) {
    return "A balanced place with mixed community impressions.";
  }

  if (selected.length === 1) {
    return `A ${selected[0]} place shaped by community impressions.`;
  }

  return `A ${selected.slice(0, -1).join(", ")}, and ${selected[selected.length - 1]} place shaped by community impressions.`;
}
