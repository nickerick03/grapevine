import { VIBE_DIMENSIONS } from "@/lib/vibe-config";
import type { PlaceVibeSummary } from "@/types/place";

import { scoreFromSummary } from "@/lib/vibe-values";

interface MiniVibeProfileProps {
  summary: PlaceVibeSummary;
}

export function MiniVibeProfile({ summary }: MiniVibeProfileProps) {
  return (
    <div className="space-y-1.5">
      {VIBE_DIMENSIONS.map((dimension) => (
        <div key={dimension.key} className="space-y-0.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${scoreFromSummary(summary, dimension.key)}%`,
                background: dimension.color,
              }}
            />
          </div>
          <p className="text-[10px] text-gray-400">{dimension.label}</p>
        </div>
      ))}
    </div>
  );
}
