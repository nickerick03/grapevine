import { useMemo } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { EXTREME_HIGH, EXTREME_LOW, TRAIT_PILL_DEFINITIONS, getTraitPillSlug, type TraitCondition } from "@/lib/chips";
import { SLIDERS, type SliderKey } from "../vibe";

const AXIS_TO_SLIDER: Record<TraitCondition["axis"], SliderKey> = {
  classic_modern: "modern",
  quiet_lively: "lively",
  cheap_premium: "premium",
  local_touristy: "touristy",
  cozy_spacious: "spacious",
};

function getSliderForCondition(condition: TraitCondition) {
  const key = AXIS_TO_SLIDER[condition.axis];
  return SLIDERS.find((slider) => slider.key === key);
}

export function TraitPillGuideScreen() {
  const navigate = useNavigate();

  const definitions = useMemo(
    () => [...TRAIT_PILL_DEFINITIONS].sort((a, b) => a.label.localeCompare(b.label)),
    [],
  );

  return (
    <div className="absolute inset-0 bg-[#fbf8f3] flex flex-col">
      <div className="flex-none flex items-center gap-3 px-4 pt-3 pb-2 bg-white/70 backdrop-blur border-b border-gray-100 sticky top-0 z-10">
        <button
          onClick={() => navigate(-1 as never)}
          className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <div className="text-gray-900 text-[16px]">Trait pill guide</div>
          <div className="text-[11px] text-gray-500">Pills trigger only at extreme slider values</div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 pb-10">
        <div className="mb-3 rounded-2xl border border-amber-100 bg-amber-50 px-3 py-2.5">
          <div className="text-[12px] text-amber-900">
            A pill appears only when required traits are very low (≤{EXTREME_LOW}) or very high (≥{EXTREME_HIGH}).
          </div>
        </div>

        <div className="space-y-2.5">
          {definitions.map((definition) => (
            <button
              key={definition.slug}
              onClick={() => navigate(`/pill/${getTraitPillSlug(definition.label)}`)}
              className="w-full text-left rounded-2xl border border-gray-100 bg-white px-3 py-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="inline-flex items-center px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-800 text-[11px]">
                    {definition.label}
                  </div>
                  <div className="text-[12px] text-gray-600 mt-1">{definition.description}</div>
                  <div className="mt-2.5 space-y-1.5">
                    {definition.conditions.map((condition, index) => {
                      const slider = getSliderForCondition(condition);
                      if (!slider) {
                        return null;
                      }

                      const target = condition.side === "low" ? 10 : 90;
                      const threshold = condition.side === "low" ? EXTREME_LOW : EXTREME_HIGH;
                      const label = condition.side === "low" ? slider.left : slider.right;

                      return (
                        <div key={`${definition.slug}-${condition.axis}-${condition.side}-${index}`} className="flex items-center gap-2">
                          <span className="w-[88px] shrink-0 text-[11px] text-gray-600 leading-none">
                            {label}
                          </span>
                          <div className="flex-1 relative h-1.5 rounded-full bg-gray-100">
                            <div
                              className="absolute inset-y-0 left-0 rounded-full"
                              style={{ width: `${target}%`, background: slider.color, opacity: 0.45 }}
                            />
                            <div
                              className="absolute -top-0.5 w-0.5 h-2.5 bg-gray-700"
                              style={{ left: `${threshold}%` }}
                            />
                            <div
                              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow"
                              style={{ left: `${target}%`, background: slider.color }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 mt-0.5" />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
