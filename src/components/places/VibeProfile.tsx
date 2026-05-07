import { VIBE_DIMENSIONS } from "@/lib/vibe-config";
import { scoreFromSummary } from "@/lib/vibe-values";
import type { PlaceVibeSummary } from "@/types/place";

import { ConfidenceBadge } from "@/components/common/ConfidenceBadge";
import { VibeSliderBar } from "@/components/places/VibeSliderBar";

interface VibeProfileProps {
  summary: PlaceVibeSummary;
  ratingCount: number;
  summarySentence: string;
}

export function VibeProfile({ summary, ratingCount, summarySentence }: VibeProfileProps) {
  return (
    <section className="rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[18px] text-gray-900">Character sheet</h2>
        <ConfidenceBadge confidence={summary.confidence_level} />
      </div>

      <p className="mb-3 text-[12px] text-gray-500">Based on {ratingCount} ratings</p>

      <div className="space-y-2">
        {VIBE_DIMENSIONS.map((dimension) => (
          <VibeSliderBar
            key={dimension.key}
            label={dimension.label}
            leftLabel={dimension.leftLabel}
            rightLabel={dimension.rightLabel}
            value={scoreFromSummary(summary, dimension.key)}
            color={dimension.color}
          />
        ))}
      </div>

      <p className="mt-3 rounded-2xl bg-gray-50 p-3 text-[13px] text-gray-700">{summarySentence}</p>
    </section>
  );
}
