import { SliderDef } from "./vibe";
import {
  clampDirectionalNumber,
  directionalToIntensity,
  directionalToPercent,
} from "@/lib/vibe-scale";

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
  scaleMode?: "percent" | "centered";
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
  scaleMode = "percent",
}: Props) {
  const interactive = !!onChange;
  const showNeutralTrack = !interactive && !hasData;
  const cardBackgroundClass = compact || showNeutralTrack ? "" : enabled ? def.bg : "bg-gray-100";
  const centeredScale = scaleMode === "centered";

  const knobPercent = centeredScale ? directionalToPercent(value) : Math.max(0, Math.min(100, value));
  const fillStartPercent = centeredScale ? Math.min(knobPercent, 50) : 0;
  const fillWidthPercent = centeredScale ? Math.abs(knobPercent - 50) : knobPercent;

  const centeredValue = centeredScale ? clampDirectionalNumber(value) : 0;
  const normalizedCenteredValue = centeredScale && Math.abs(centeredValue) < 0.05 ? 0 : centeredValue;
  const directionalIntensity = centeredScale ? directionalToIntensity(normalizedCenteredValue) : 0;
  const leftActive = centeredScale && normalizedCenteredValue < 0;
  const rightActive = centeredScale && normalizedCenteredValue > 0;

  const comparisonMarkerPercent = comparisonValue === undefined
    ? undefined
    : centeredScale
      ? directionalToPercent(comparisonValue)
      : Math.max(0, Math.min(100, comparisonValue));

  const formatIntensity = (raw: number): string => {
    const rounded = Math.round(raw * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(1);
  };

  const leftLabelColor = !enabled
    ? "#9CA3AF"
    : leftActive
      ? def.color
      : "#6B7280";
  const rightLabelColor = !enabled
    ? "#9CA3AF"
    : rightActive
      ? def.color
      : "#6B7280";
  const canInteract = interactive && (enabled || !!onToggle);
  const minValue = centeredScale ? -10 : 0;
  const maxValue = centeredScale ? 10 : 100;

  const nudgeToward = (direction: -1 | 1) => {
    if (!canInteract) {
      return;
    }

    if (!enabled && onToggle) {
      onToggle(true);
    }

    const nextValue = Math.max(minValue, Math.min(maxValue, value + direction));
    if (nextValue !== value) {
      onChange?.(nextValue);
    }
  };

  const labelButtonClass = "w-[4.1rem] sm:w-[4.9rem] text-[10px] leading-tight whitespace-nowrap overflow-hidden text-ellipsis transition-colors";

  return (
    <div
      className={`${compact ? "" : "px-2 py-2.5"} rounded-2xl ${cardBackgroundClass} transition-colors`}
    >
      <div className="flex items-center gap-0.5">
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
          <button
            type="button"
            onClick={() => nudgeToward(-1)}
            disabled={!canInteract}
            aria-label={`Move ${def.left} by 1`}
            className={`${labelButtonClass} text-right flex-none shrink-0 ${canInteract ? "cursor-pointer" : "cursor-default"} bg-transparent border-0 p-0`}
            style={{ color: centeredScale ? leftLabelColor : enabled ? "#6B7280" : "#9CA3AF" }}
          >
            {leftActive ? (
              <span className="mr-1 font-medium">
                {formatIntensity(directionalIntensity)}
              </span>
            ) : null}
            {def.left}
          </button>
        ) : null}

        {/* Slider track */}
        <div className="relative flex-1 py-1 min-w-0 px-[10px]">
          <div
            className="relative h-4 rounded-full"
            style={{ background: showNeutralTrack ? "#E5E7EB" : enabled ? `${def.color}1a` : "#E5E7EB" }}
          >
            {/* Filled portion */}
            {!showNeutralTrack ? (
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  left: `${fillStartPercent}%`,
                  width: `${fillWidthPercent}%`,
                  background: enabled ? `linear-gradient(90deg, ${def.color}44, ${def.color}cc)` : "linear-gradient(90deg, #D1D5DB, #9CA3AF)",
                }}
              />
            ) : null}

            {/* Comparison marker */}
            {!showNeutralTrack && comparisonMarkerPercent !== undefined && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-gray-600/30"
                style={{ left: `${comparisonMarkerPercent}%` }}
              />
            )}

            {/* Center marker for directional scale */}
            {!showNeutralTrack && centeredScale ? (
              <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-gray-400/50" />
            ) : null}

            {/* Pill knob */}
            {!showNeutralTrack ? (
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-9 rounded-full bg-white border-2 flex items-center justify-center"
                style={{
                  left: `${knobPercent}%`,
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
              min={centeredScale ? -10 : 0}
              max={centeredScale ? 10 : 100}
              step={centeredScale ? 1 : 1}
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
              className="absolute inset-y-0 left-[10px] right-[10px] opacity-0 cursor-pointer"
              style={{ pointerEvents: enabled || !!onToggle ? "auto" : "none" }}
            />
          )}
        </div>

        {/* Right label */}
        {!showNeutralTrack ? (
          <button
            type="button"
            onClick={() => nudgeToward(1)}
            disabled={!canInteract}
            aria-label={`Move ${def.right} by 1`}
            className={`${labelButtonClass} text-left flex-none shrink-0 ${canInteract ? "cursor-pointer" : "cursor-default"} bg-transparent border-0 p-0`}
            style={{ color: centeredScale ? rightLabelColor : enabled ? "#6B7280" : "#9CA3AF" }}
          >
            {def.right}
            {rightActive ? (
              <span className="ml-1 font-medium">
                {formatIntensity(directionalIntensity)}
              </span>
            ) : null}
          </button>
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
