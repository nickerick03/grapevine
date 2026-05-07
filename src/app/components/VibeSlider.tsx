import { SliderDef } from "./vibe";

interface Props {
  def: SliderDef;
  value: number;
  onChange?: (v: number) => void;
  enabled?: boolean;
  onToggle?: (b: boolean) => void;
  compact?: boolean;
  showToggle?: boolean;
  toggleWithDot?: boolean;
  comparisonValue?: number;
  hasData?: boolean;
}

export function VibeSlider({
  def,
  value,
  onChange,
  enabled = true,
  onToggle,
  compact,
  showToggle,
  toggleWithDot = false,
  comparisonValue,
  hasData = true,
}: Props) {
  const interactive = !!onChange;
  const showNeutralTrack = !interactive && !hasData;
  const cardBackgroundClass = compact || showNeutralTrack ? "" : enabled ? def.bg : "bg-gray-100";

  return (
    <div
      className={`${compact ? "" : "px-3 py-2.5"} rounded-2xl ${cardBackgroundClass} transition-colors`}
    >
      <div className="flex items-center gap-1.5">
        {/* Color dot */}
        {!showNeutralTrack ? (
          toggleWithDot && onToggle ? (
            <button
              type="button"
              onClick={() => onToggle(!enabled)}
              aria-label={`${enabled ? "Disable" : "Enable"} ${def.left} to ${def.right} filter`}
              className="w-3 h-3 rounded-full flex-none transition-colors"
              style={{ background: enabled ? def.color : "#B8BDC9" }}
            />
          ) : (
            <span className="w-2 h-2 rounded-full flex-none" style={{ background: def.color }} />
          )
        ) : null}

        {/* Left label */}
        {!showNeutralTrack ? (
          <span className={`text-[10px] w-[4rem] text-right flex-none leading-tight whitespace-nowrap ${enabled ? "text-gray-500" : "text-gray-400"}`}>
            {def.left}
          </span>
        ) : null}

        {/* Slider track */}
        <div className="relative flex-1 py-1">
          <div
            className="relative h-4 rounded-full mx-2"
            style={{ background: showNeutralTrack ? "#E5E7EB" : enabled ? `${def.color}1a` : "#E5E7EB" }}
          >
            {/* Filled portion */}
            {!showNeutralTrack ? (
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${value}%`,
                  background: enabled ? `linear-gradient(90deg, ${def.color}44, ${def.color}cc)` : "linear-gradient(90deg, #D1D5DB, #9CA3AF)",
                }}
              />
            ) : null}

            {/* Comparison marker */}
            {!showNeutralTrack && comparisonValue !== undefined && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-gray-600/30"
                style={{ left: `${comparisonValue}%` }}
              />
            )}

            {/* Pill knob */}
            {!showNeutralTrack ? (
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-9 rounded-full bg-white border-2 flex items-center justify-center"
                style={{
                  left: `${value}%`,
                  borderColor: enabled ? def.color : "#9CA3AF",
                  boxShadow: enabled
                    ? `0 2px 10px ${def.color}44, 0 1px 4px rgba(0,0,0,0.12)`
                    : "0 2px 10px rgba(156,163,175,0.35), 0 1px 4px rgba(0,0,0,0.1)",
                }}
              >
                <div className="flex gap-[3px]">
                  <div className="w-[2px] h-2.5 rounded-full" style={{ background: enabled ? `${def.color}bb` : "#9CA3AF" }} />
                  <div className="w-[2px] h-2.5 rounded-full" style={{ background: enabled ? `${def.color}bb` : "#9CA3AF" }} />
                </div>
              </div>
            ) : null}
          </div>

          {/* Invisible range input overlay */}
          {interactive && (
            <input
              type="range"
              min={0}
              max={100}
              value={value}
              onMouseDown={() => {
                if (!enabled) {
                  onToggle?.(true);
                }
              }}
              onTouchStart={() => {
                if (!enabled) {
                  onToggle?.(true);
                }
              }}
              onChange={(e) => onChange?.(Number(e.target.value))}
              disabled={!enabled && !onToggle}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              style={{ pointerEvents: enabled || !!onToggle ? "auto" : "none" }}
            />
          )}
        </div>

        {/* Right label */}
        {!showNeutralTrack ? (
          <span className={`text-[10px] w-[4rem] text-left flex-none leading-tight whitespace-nowrap ${enabled ? "text-gray-500" : "text-gray-400"}`}>
            {def.right}
          </span>
        ) : null}

        {/* Toggle */}
        {showToggle && !toggleWithDot && (
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
