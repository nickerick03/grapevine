interface VibeSliderBarProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  value: number;
  color: string;
}

export function VibeSliderBar({ label, leftLabel, rightLabel, value, color }: VibeSliderBarProps) {
  return (
    <div className="rounded-2xl p-3" style={{ background: `${color}0D` }}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[13px] text-gray-800">{label}</p>
        <p className="text-[12px] text-gray-500">{Math.round(value)}</p>
      </div>
      <div className="h-2 rounded-full bg-white/80">
        <div className="h-2 rounded-full" style={{ width: `${value}%`, background: color }} />
      </div>
      <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
        <span>{leftLabel}</span>
        <span>{rightLabel}</span>
      </div>
    </div>
  );
}
