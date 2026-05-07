import type { PlaceVibeSummary } from "@/types/place";

interface ConfidenceBadgeProps {
  confidence: PlaceVibeSummary["confidence_level"];
}

const badgeClassByConfidence: Record<PlaceVibeSummary["confidence_level"], string> = {
  "No ratings yet": "bg-gray-100 text-gray-600 border-gray-200",
  "Low confidence": "bg-amber-50 text-amber-700 border-amber-200",
  "Medium confidence": "bg-blue-50 text-blue-700 border-blue-200",
  "High confidence": "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function ConfidenceBadge({ confidence }: ConfidenceBadgeProps) {
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11px] ${badgeClassByConfidence[confidence]}`}>
      {confidence}
    </span>
  );
}
