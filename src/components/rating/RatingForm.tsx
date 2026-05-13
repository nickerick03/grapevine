import { useMemo, useState } from "react";

import { VIBE_DIMENSIONS } from "@/lib/vibe-config";
import { directionalToLegacyScore, directionalToPercent, legacyScoreToDirectional } from "@/lib/vibe-scale";
import { normalizeVisitContexts, type VisitContext, type VibeValues } from "@/types/place";

const VISIT_CONTEXTS: VisitContext[] = [
  "Weekday afternoon",
  "Weekday evening",
  "Weekend afternoon",
  "Weekend evening",
  "Late night",
];

interface RatingFormProps {
  initialValues: VibeValues;
  initialVisitContexts?: VisitContext[] | null;
  initialVisitContext?: VisitContext | null;
  initialNote?: string | null;
  onSubmit: (payload: {
    values: VibeValues;
    visit_contexts: VisitContext[] | null;
    visit_context: VisitContext | null;
    note: string | null;
  }) => Promise<{ error: string | null }>;
  submitting: boolean;
}

type DirectionalVibeValues = Record<keyof VibeValues, number>;

function toDirectionalValues(values: VibeValues): DirectionalVibeValues {
  return {
    classic_modern: legacyScoreToDirectional(values.classic_modern),
    quiet_lively: legacyScoreToDirectional(values.quiet_lively),
    cheap_premium: legacyScoreToDirectional(values.cheap_premium),
    local_touristy: legacyScoreToDirectional(values.local_touristy),
    cozy_spacious: legacyScoreToDirectional(values.cozy_spacious),
  };
}

function toStoredValues(values: DirectionalVibeValues): VibeValues {
  return {
    classic_modern: directionalToLegacyScore(values.classic_modern),
    quiet_lively: directionalToLegacyScore(values.quiet_lively),
    cheap_premium: directionalToLegacyScore(values.cheap_premium),
    local_touristy: directionalToLegacyScore(values.local_touristy),
    cozy_spacious: directionalToLegacyScore(values.cozy_spacious),
  };
}

export function RatingForm({
  initialValues,
  initialVisitContexts = null,
  initialVisitContext = null,
  initialNote = null,
  onSubmit,
  submitting,
}: RatingFormProps) {
  const [values, setValues] = useState<DirectionalVibeValues>(() => toDirectionalValues(initialValues));
  const [visitContexts, setVisitContexts] = useState<VisitContext[]>(
    normalizeVisitContexts(initialVisitContexts ?? initialVisitContext ?? null),
  );
  const [note, setNote] = useState(initialNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const noteLength = useMemo(() => note.length, [note]);

  const toggleVisitContext = (context: VisitContext) => {
    setVisitContexts((current) => (
      current.includes(context)
        ? current.filter((entry) => entry !== context)
        : [...current, context]
    ));
  };

  async function submit() {
    setError(null);
    setSuccess(null);

    const result = await onSubmit({
      values: toStoredValues(values),
      visit_contexts: visitContexts.length > 0 ? visitContexts : null,
      visit_context: visitContexts[0] ?? null,
      note: note.trim() ? note.trim().slice(0, 160) : null,
    });

    if (result.error) {
      setError(result.error);
      return;
    }

    setSuccess("Thanks, your impression helped improve this place's profile.");
  }

  return (
    <section className="space-y-4 rounded-3xl border border-gray-100 bg-white p-4 shadow-[0_2px_12px_rgba(0,0,0,0.04)]">
      <p className="text-[12px] text-gray-500">
        Each scale is centered at 0. Left side means stronger left trait, right side means stronger right trait.
      </p>
      {VIBE_DIMENSIONS.map((dimension) => {
        const directionalValue = values[dimension.key];
        const leftActive = directionalValue < 0;
        const rightActive = directionalValue > 0;
        const intensity = Math.abs(directionalValue);
        const percent = directionalToPercent(directionalValue);

        return (
          <label key={dimension.key} className="block rounded-2xl p-3" style={{ background: `${dimension.color}0D` }}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[13px] text-gray-800">{dimension.label}</span>
              <span className="text-[12px] text-gray-500">
                {directionalValue === 0
                  ? "Neutral"
                  : `${directionalValue < 0 ? dimension.leftLabel : dimension.rightLabel} ${intensity}`}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <span
                className="w-[5.8rem] text-right text-[10px] leading-tight whitespace-nowrap transition-colors"
                style={{ color: leftActive ? dimension.color : "#6B7280" }}
              >
                {leftActive ? <span className="mr-1 font-medium">{intensity}</span> : null}
                {dimension.leftLabel}
              </span>

              <div className="relative flex-1 py-1">
                <div className="relative h-4 rounded-full mx-2 bg-white/80">
                  <div
                    className="absolute inset-y-0 rounded-full"
                    style={{
                      left: `${Math.min(percent, 50)}%`,
                      width: `${Math.abs(percent - 50)}%`,
                      background: `linear-gradient(90deg, ${dimension.color}44, ${dimension.color}cc)`,
                    }}
                  />
                  <div className="absolute top-0 bottom-0 left-1/2 w-px -translate-x-1/2 bg-gray-400/50" />
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-6 w-9 rounded-full bg-white border-2 flex items-center justify-center"
                    style={{
                      left: `${percent}%`,
                      borderColor: dimension.color,
                      boxShadow: `0 2px 10px ${dimension.color}44, 0 1px 4px rgba(0,0,0,0.12)`,
                    }}
                  >
                    <div className="flex gap-[3px]">
                      <div className="w-[2px] h-2.5 rounded-full" style={{ background: `${dimension.color}bb` }} />
                      <div className="w-[2px] h-2.5 rounded-full" style={{ background: `${dimension.color}bb` }} />
                    </div>
                  </div>
                </div>
                <input
                  type="range"
                  min={-10}
                  max={10}
                  step={1}
                  value={directionalValue}
                  onChange={(event) =>
                    setValues((previous) => ({
                      ...previous,
                      [dimension.key]: Number.parseInt(event.target.value, 10),
                    }))
                  }
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </div>

              <span
                className="w-[5.8rem] text-left text-[10px] leading-tight whitespace-nowrap transition-colors"
                style={{ color: rightActive ? dimension.color : "#6B7280" }}
              >
                {dimension.rightLabel}
                {rightActive ? <span className="ml-1 font-medium">{intensity}</span> : null}
              </span>
            </div>
          </label>
        );
      })}

      <div>
        <p className="mb-2 text-[12px] uppercase tracking-wide text-gray-500">Visit context (optional)</p>
        <p className="mb-2 text-[11px] text-gray-500">Select all that apply.</p>
        <div className="flex flex-wrap gap-2">
          {VISIT_CONTEXTS.map((context) => (
            <button
              key={context}
              type="button"
              onClick={() => toggleVisitContext(context)}
              className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                visitContexts.includes(context)
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 bg-white text-gray-700 hover:border-gray-300"
              }`}
            >
              {context}
            </button>
          ))}
        </div>
      </div>

      <label className="block">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-wide text-gray-500">Quick note (optional)</span>
          <span className="text-[11px] text-gray-400">{noteLength}/160</span>
        </div>
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value.slice(0, 160))}
          className="h-24 w-full resize-none rounded-2xl border border-gray-200 bg-gray-50 p-3 text-[13px] text-gray-800 outline-none focus:border-gray-400"
          placeholder="What stood out?"
          maxLength={160}
        />
      </label>

      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}
      {success ? <p className="text-[12px] text-emerald-700">{success}</p> : null}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="w-full rounded-2xl bg-gray-900 py-3 text-[14px] text-white disabled:opacity-60"
      >
        {submitting ? "Saving..." : "Submit rating"}
      </button>
    </section>
  );
}
