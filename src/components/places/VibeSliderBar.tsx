import { directionalToPercent, legacyScoreToDirectionalNumber } from "@/lib/vibe-scale";

interface VibeSliderBarProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  color: string;
}

export function VibeSliderBar({ label, leftLabel, rightLabel, value, color }: VibeSliderBarProps) {
  const directionalValue = legacyScoreToDirectionalNumber(value);
  const position = directionalToPercent(directionalValue);
  const normalizedDirectionalValue = Math.abs(directionalValue) < 0.05 ? 0 : directionalValue;
  const leftActive = normalizedDirectionalValue < 0;
  const rightActive = normalizedDirectionalValue > 0;
  const intensity = Math.abs(Math.round(directionalValue * 10) / 10);
  const formattedIntensity = Number.isInteger(intensity) ? `${intensity}` : intensity.toFixed(1);

  return (
    <div className="rounded-2xl px-2 py-3" style={{ background: `${color}0D` }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[13px] text-gray-800">{label}</p>
        <p className="text-[12px] text-gray-500">
          {normalizedDirectionalValue === 0
            ? "Neutral"
            : `${normalizedDirectionalValue < 0 ? leftLabel : rightLabel} ${formattedIntensity}`}
        </p>
      </div>
      <div className="flex items-center gap-0.5">
        <span
          className="w-[4.1rem] sm:w-[4.9rem] text-right text-[10px] leading-tight whitespace-nowrap overflow-hidden text-ellipsis transition-colors shrink-0"
          style={{ color: leftActive ? color : "#6B7280" }}
        >
          {leftActive ? <span className="mr-1 font-medium">{formattedIntensity}</span> : null}
          {leftLabel}
        </span>

        <div className="relative h-2 flex-1 min-w-0 rounded-full bg-white/80 overflow-hidden">
          <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-gray-400/60" />
          <div
            className="absolute inset-y-0 rounded-full"
            style={{
              left: `${Math.min(position, 50)}%`,
              width: `${Math.abs(position - 50)}%`,
              background: color,
            }}
          />
        </div>

        <span
          className="w-[4.1rem] sm:w-[4.9rem] text-left text-[10px] leading-tight whitespace-nowrap overflow-hidden text-ellipsis transition-colors shrink-0"
          style={{ color: rightActive ? color : "#6B7280" }}
        >
          {rightLabel}
          {rightActive ? <span className="ml-1 font-medium">{formattedIntensity}</span> : null}
        </span>
      </div>
    </div>
  );
}
