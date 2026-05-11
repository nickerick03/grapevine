import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle, ShieldAlert, Trophy, Upload } from "lucide-react";
import { AdminLayout } from "./admin/AdminLayout";
import { useAdminGuard } from "./admin/useAdminGuard";
import {
  adminCreateCup,
  adminDeleteCup,
  adminFinalizeCup,
  adminSetCupActive,
  adminUpdateCup,
  getAdminCups,
  type CupInput,
} from "@/lib/services/cups";
import { sanitizeCupSvgMarkup, svgMarkupToDataUri } from "@/lib/cup-artwork";
import type { CupRecord } from "@/types/cup";

const DEFAULT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 140 140" role="img" aria-label="Cup">
  <defs>
    <linearGradient id="cupDefault" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#ef4444"/>
    </linearGradient>
  </defs>
  <rect x="10" y="10" width="120" height="120" rx="28" fill="url(#cupDefault)" />
  <text x="70" y="80" text-anchor="middle" font-size="56">🏆</text>
</svg>`;

type DraftState = CupInput;

function toDateTimeLocalValue(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function fromDateTimeLocalValue(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

function createDefaultDraft(): DraftState {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + 14);
  return {
    name: "",
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    rewardPoints: 100,
    svgMarkup: DEFAULT_SVG,
    isActive: false,
  };
}

function validateCupDraft(draft: DraftState): string | null {
  if (!draft.name.trim()) {
    return "Cup name is required.";
  }

  if (!draft.startAt || !draft.endAt) {
    return "Start and end dates are required.";
  }

  if (new Date(draft.startAt).getTime() >= new Date(draft.endAt).getTime()) {
    return "Start date/time must be before end date/time.";
  }

  if (!Number.isFinite(draft.rewardPoints) || draft.rewardPoints < 0) {
    return "Reward points must be non-negative.";
  }

  try {
    sanitizeCupSvgMarkup(draft.svgMarkup);
  } catch (error) {
    return error instanceof Error ? error.message : "Cup SVG is invalid.";
  }

  return null;
}

function formatDateRange(startAt: string, endAt: string): string {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startAt} - ${endAt}`;
  }

  return `${start.toLocaleString()} - ${end.toLocaleString()}`;
}

export function AdminCupsScreen() {
  const { loading: guardLoading, allowed } = useAdminGuard();
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [list, setList] = useState<CupRecord[]>([]);
  const [selectedCupId, setSelectedCupId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(createDefaultDraft());
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const selectedCup = useMemo(
    () => list.find((entry) => entry.id === selectedCupId) ?? null,
    [list, selectedCupId],
  );

  const previewUri = useMemo(() => {
    try {
      return svgMarkupToDataUri(sanitizeCupSvgMarkup(draft.svgMarkup));
    } catch {
      return null;
    }
  }, [draft.svgMarkup]);

  const loadCups = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminCups();
      setList(data);
      if (selectedCupId && !data.some((row) => row.id === selectedCupId)) {
        setSelectedCupId(null);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load Cups.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) {
      return;
    }
    void loadCups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const resetDraft = () => {
    setSelectedCupId(null);
    setDraft(createDefaultDraft());
    setStatus(null);
    setError(null);
  };

  const startEdit = (cup: CupRecord) => {
    setSelectedCupId(cup.id);
    setDraft({
      name: cup.name,
      startAt: cup.startAt,
      endAt: cup.endAt,
      rewardPoints: cup.rewardPoints,
      svgMarkup: cup.svgMarkup,
      isActive: cup.isActive,
    });
    setStatus(null);
    setError(null);
  };

  const handleSave = async () => {
    const validationError = validateCupDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      if (selectedCupId) {
        await adminUpdateCup(selectedCupId, draft);
        setStatus("Cup updated.");
      } else {
        await adminCreateCup(draft);
        setStatus("Cup created.");
      }
      await loadCups();
      if (!selectedCupId) {
        resetDraft();
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save Cup.");
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (cup: CupRecord, next: boolean) => {
    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await adminSetCupActive(cup.id, next);
      setStatus(next ? "Cup activated." : "Cup deactivated.");
      await loadCups();
      if (selectedCupId === cup.id) {
        setDraft((previous) => ({ ...previous, isActive: next }));
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to change active state.");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async (cup: CupRecord) => {
    const confirmed = window.confirm(`Finalize "${cup.name}" now? Rewards and placements are idempotent but finalization marks this Cup completed.`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      const result = await adminFinalizeCup(cup.id);
      if (result.alreadyFinalized) {
        setStatus("Cup was already finalized.");
      } else {
        setStatus(`Cup finalized. Placements saved: ${result.placementsSaved}, rewards saved: ${result.rewardsSaved}.`);
      }
      await loadCups();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to finalize Cup.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cup: CupRecord) => {
    const confirmed = window.confirm(`Delete "${cup.name}"? This also removes placements and reward transactions linked to this Cup.`);
    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);
    try {
      await adminDeleteCup(cup.id);
      setStatus("Cup deleted.");
      if (selectedCupId === cup.id) {
        resetDraft();
      }
      await loadCups();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Failed to delete Cup.");
    } finally {
      setSaving(false);
    }
  };

  const handleUploadSvg = async (file: File | null) => {
    if (!file) return;

    try {
      const text = await file.text();
      const sanitized = sanitizeCupSvgMarkup(text);
      setDraft((previous) => ({ ...previous, svgMarkup: sanitized }));
      setError(null);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Could not read SVG file.");
    }
  };

  if (guardLoading || !allowed) {
    return (
      <div className="absolute inset-0 bg-[#fbf8f3] flex items-center justify-center text-[13px] text-gray-500">
        Checking access…
      </div>
    );
  }

  return (
    <AdminLayout title="Admin · Cup Maker">
      <div className="space-y-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="text-[12px] text-gray-500 mb-2">{selectedCup ? "Edit Cup" : "Create Cup"}</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <label className="text-[12px] text-gray-600">
              Cup name
              <input
                value={draft.name}
                onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))}
                placeholder="Summer Budapest Cup"
                className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[13px] outline-none focus:border-gray-400"
              />
            </label>

            <label className="text-[12px] text-gray-600">
              Reward points
              <input
                value={draft.rewardPoints}
                onChange={(event) =>
                  setDraft((previous) => ({
                    ...previous,
                    rewardPoints: Number.isFinite(event.target.valueAsNumber)
                      ? Math.max(0, Math.round(event.target.valueAsNumber))
                      : 0,
                  }))
                }
                min={0}
                type="number"
                className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[13px] outline-none focus:border-gray-400"
              />
            </label>

            <label className="text-[12px] text-gray-600">
              Start date and time
              <input
                value={toDateTimeLocalValue(draft.startAt)}
                onChange={(event) => {
                  const next = fromDateTimeLocalValue(event.target.value);
                  setDraft((previous) => ({ ...previous, startAt: next }));
                }}
                type="datetime-local"
                className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[13px] outline-none focus:border-gray-400"
              />
            </label>

            <label className="text-[12px] text-gray-600">
              End date and time
              <input
                value={toDateTimeLocalValue(draft.endAt)}
                onChange={(event) => {
                  const next = fromDateTimeLocalValue(event.target.value);
                  setDraft((previous) => ({ ...previous, endAt: next }));
                }}
                type="datetime-local"
                className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-[13px] outline-none focus:border-gray-400"
              />
            </label>
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="text-[12px] text-gray-600">Cup SVG artwork</div>
            <input
              ref={uploadRef}
              type="file"
              accept="image/svg+xml,.svg"
              className="hidden"
              onChange={(event) => {
                void handleUploadSvg(event.target.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => uploadRef.current?.click()}
              className="h-9 px-3 rounded-xl border border-gray-200 text-[12px] text-gray-700 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload SVG
            </button>
          </div>
          <textarea
            value={draft.svgMarkup}
            onChange={(event) => setDraft((previous) => ({ ...previous, svgMarkup: event.target.value }))}
            rows={6}
            className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] font-mono outline-none focus:border-gray-400"
          />

          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDraft((previous) => ({ ...previous, isActive: !previous.isActive }))}
              className={`h-8 px-3 rounded-full border text-[12px] ${
                draft.isActive ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-gray-50 border-gray-200 text-gray-600"
              }`}
            >
              {draft.isActive ? "Will be active" : "Will stay inactive"}
            </button>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="h-8 px-3 rounded-full bg-gray-900 text-white text-[12px] disabled:opacity-60"
            >
              {saving ? "Saving..." : selectedCup ? "Save changes" : "Create Cup"}
            </button>

            {selectedCup ? (
              <button
                type="button"
                onClick={resetDraft}
                disabled={saving}
                className="h-8 px-3 rounded-full border border-gray-200 text-[12px] text-gray-600"
              >
                Cancel edit
              </button>
            ) : null}
          </div>

          {previewUri ? (
            <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2 flex items-center gap-3">
              <img src={previewUri} alt="Cup preview" className="w-14 h-14 rounded-lg object-contain bg-white border border-gray-100" />
              <div>
                <div className="text-[12px] text-gray-900">Artwork preview</div>
                <div className="text-[11px] text-gray-500">Renders with safe SVG checks</div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              <span>{error}</span>
            </div>
          ) : null}

          {status ? (
            <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-700 flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>{status}</span>
            </div>
          ) : null}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <div className="text-[12px] text-gray-500 mb-2">Cups</div>
          {loading ? (
            <div className="text-[13px] text-gray-500">Loading cups...</div>
          ) : list.length === 0 ? (
            <div className="text-[13px] text-gray-500">No Cups created yet.</div>
          ) : (
            <div className="space-y-2">
              {list.map((cup) => {
                const selected = selectedCupId === cup.id;
                const cupPreviewUri = svgMarkupToDataUri(cup.svgMarkup);
                return (
                  <div
                    key={cup.id}
                    className={`rounded-xl border p-2 ${selected ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white"}`}
                  >
                    <div className="flex items-center gap-2">
                      <img src={cupPreviewUri} alt={`${cup.name} preview`} className="w-11 h-11 rounded-lg border border-gray-100 bg-white object-contain" />
                      <div className="flex-1 min-w-0">
                          <div className="text-[13px] text-gray-900 truncate">{cup.name}</div>
                          <div className="text-[11px] text-gray-500">
                          {formatDateRange(cup.startAt, cup.endAt)} · {cup.rewardPoints} pts
                          </div>
                        <div className="text-[10px] text-gray-400">
                          {cup.isActive ? "Active" : "Inactive"} · {cup.finalizedAt ? `Finalized ${new Date(cup.finalizedAt).toLocaleString()}` : "Not finalized"}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => startEdit(cup)}
                        className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-700"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleActivate(cup, !cup.isActive)}
                        className={`rounded-full border px-2 py-0.5 text-[11px] ${
                          cup.isActive ? "border-amber-200 text-amber-700" : "border-emerald-200 text-emerald-700"
                        }`}
                      >
                        {cup.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        type="button"
                        disabled={saving || Boolean(cup.finalizedAt)}
                        onClick={() => void handleFinalize(cup)}
                        className="rounded-full border border-blue-200 px-2 py-0.5 text-[11px] text-blue-700 disabled:opacity-50"
                      >
                        Finalize now
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void handleDelete(cup)}
                        className="rounded-full border border-rose-200 px-2 py-0.5 text-[11px] text-rose-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-800 flex items-start gap-2">
          <Trophy className="w-4 h-4 mt-0.5 flex-none" />
          <p>Cup rewards are applied only to all-time score at finalization (1st: 1x, 2nd: 0.5x, 3rd: 0.25x).</p>
        </div>
      </div>
    </AdminLayout>
  );
}
