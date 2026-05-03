import { SliderDef } from "./vibe";

interface Props {
  def: SliderDef;
  value: number;
  onChange?: (v: number) => void;
  enabled?: boolean;
  onToggle?: (b: boolean) => void;
  compact?: boolean;
  showToggle?: boolean;
  comparisonValue?: number;
}

export function VibeSlider({ def, value, onChange, enabled = true, onToggle, compact, showToggle, comparisonValue }: Props) {
  const interactive = !!onChange;

  return (
    <div
      className={`${compact ? "" : "px-3 py-2.5"} rounded-2xl ${compact ? "" : def.bg} transition-opacity ${enabled ? "" : "opacity-40"}`}
    >
      <div className="flex items-center gap-2">
        {/* Color dot */}
        <span className="w-2 h-2 rounded-full flex-none" style={{ background: def.color }} />

        {/* Left label */}
        <span className="text-[10px] text-gray-500 w-10 text-right flex-none leading-tight">{def.left}</span>

        {/* Slider track */}
        <div className="relative flex-1 py-1">
          <div
            className="relative h-4 rounded-full mx-[1.125rem]"
            style={{ background: `${def.color}1a` }}
          >
            {/* Filled portion */}
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{
                width: `${value}%`,
                background: `linear-gradient(90deg, ${def.color}44, ${def.color}cc)`,
              }}
            />

            {/* Comparison marker */}
            {comparisonValue !== undefined && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-gray-600/30"
                style={{ left: `${comparisonValue}%` }}
              />
            )}

            {/* Pill knob */}
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-9 rounded-full bg-white border-2 flex items-center justify-center"
              style={{
                left: `${value}%`,
                borderColor: def.color,
                boxShadow: `0 2px 10px ${def.color}44, 0 1px 4px rgba(0,0,0,0.12)`,
              }}
            >
              <div className="flex gap-[3px]">
                <div className="w-[2px] h-2.5 rounded-full" style={{ background: `${def.color}bb` }} />
                <div className="w-[2px] h-2.5 rounded-full" style={{ background: `${def.color}bb` }} />
              </div>
            </div>
          </div>

          {/* Invisible range input overlay */}
          {interactive && (
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              onChange={(e) => onChange?.(Number(e.target.value))}
              disabled={!enabled}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              style={{ pointerEvents: enabled ? "auto" : "none" }}
            />
          )}
        </div>

        {/* Right label */}
        <span className="text-[10px] text-gray-500 w-10 text-left flex-none leading-tight">{def.right}</span>

        {/* Toggle */}
        {showToggle && (
          <button
            onClick={() => onToggle?.(!enabled)}
            className="w-9 h-5 rounded-full transition-colors relative flex-none"
            style={{ background: enabled ? def.color : "#E5E7EB" }}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                enabled ? "left-[18px]" : "left-0.5"
              }`}
            />
          </button>
        )}
      </div>
    </div>
  );
}