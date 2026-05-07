import { useMemo, useState } from "react";

import { VIBE_DIMENSIONS } from "@/lib/vibe-config";
import type { PlaceRatingRecord, VisitContext, VibeValues } from "@/types/place";

const VISIT_CONTEXTS: VisitContext[] = [
  "Weekday afternoon",
  "Weekday evening",
  "Weekend afternoon",
  "Weekend evening",
  "Late night",
];

interface RatingFormProps {
  initialValues: VibeValues;
  initialVisitContext?: VisitContext | null;
  initialNote?: string | null;
  onSubmit: (payload: {
    values: VibeValues;
    visit_context: VisitContext | null;
    note: string | null;
  }) => Promise<{ error: string | null }>;
  submitting: boolean;
}

export function RatingForm({
  initialValues,
  initialVisitContext = null,
  initialNote = null,
  onSubmit,
  submitting,
}: RatingFormProps) {
  const [values, setValues] = useState<VibeValues>(initialValues);
  const [visitContext, setVisitContext] = useState<VisitContext | null>(initialVisitContext);
  const [note, setNote] = useState(initialNote ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const noteLength = useMemo(() => note.length, [note]);

  async function submit() {
    setError(null);
    setSuccess(null);

    const result = await onSubmit({
      values,
      visit_context: visitContext,
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
      {VIBE_DIMENSIONS.map((dimension) => (
        <label key={dimension.key} className="block rounded-2xl p-3" style={{ background: `${dimension.color}0D` }}>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px] text-gray-800">{dimension.label}</span>
            <span className="text-[12px] text-gray-500">{Math.round(values[dimension.key])}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={values[dimension.key]}
            onChange={(event) =>
              setValues((previous) => ({
                ...previous,
                [dimension.key]: Number.parseInt(event.target.value, 10),
              }))
            }
            className="w-full"
            style={{ accentColor: dimension.color }}
          />
          <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
            <span>{dimension.leftLabel}</span>
            <span>{dimension.rightLabel}</span>
          </div>
        </label>
      ))}

      <div>
        <p className="mb-2 text-[12px] uppercase tracking-wide text-gray-500">Visit context (optional)</p>
        <div className="flex flex-wrap gap-2">
          {VISIT_CONTEXTS.map((context) => (
            <button
              key={context}
              type="button"
              onClick={() => setVisitContext((current) => (current === context ? null : context))}
              className={`rounded-full border px-3 py-1.5 text-[12px] transition ${
                visitContext === context
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
