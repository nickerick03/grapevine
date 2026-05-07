import { useEffect, useMemo, useState } from "react";
import {
  LEGAL_DOCUMENT_DEFINITIONS,
  listLegalDocuments,
  upsertLegalDocument,
  type LegalDocumentKey,
  type LegalDocumentRecord,
} from "@/lib/services/legal";
import { AdminLayout } from "./admin/AdminLayout";
import { useAdminGuard } from "./admin/useAdminGuard";

type DraftState = {
  key: LegalDocumentKey;
  title: string;
  content: string;
};

function toDraft(documentKey: LegalDocumentKey, row?: LegalDocumentRecord | null): DraftState {
  const definition = LEGAL_DOCUMENT_DEFINITIONS.find((item) => item.key === documentKey);
  return {
    key: documentKey,
    title: row?.title?.trim() || definition?.title || "Untitled",
    content: row?.content ?? "",
  };
}

export function AdminLegalScreen() {
  const { loading: guardLoading, allowed } = useAdminGuard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [rowsByKey, setRowsByKey] = useState<Record<LegalDocumentKey, LegalDocumentRecord | null>>({
    "privacy-policy": null,
    "cookie-policy": null,
    "terms-of-service": null,
    impressum: null,
    "data-deletion": null,
    contact: null,
  });

  const [selectedKey, setSelectedKey] = useState<LegalDocumentKey>("privacy-policy");
  const [draft, setDraft] = useState<DraftState>(toDraft("privacy-policy", null));

  const selectedDefinition = useMemo(
    () => LEGAL_DOCUMENT_DEFINITIONS.find((item) => item.key === selectedKey) ?? LEGAL_DOCUMENT_DEFINITIONS[0],
    [selectedKey],
  );

  const selectedRow = rowsByKey[selectedKey];

  const loadDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await listLegalDocuments();
      const nextMap: Record<LegalDocumentKey, LegalDocumentRecord | null> = {
        "privacy-policy": null,
        "cookie-policy": null,
        "terms-of-service": null,
        impressum: null,
        "data-deletion": null,
        contact: null,
      };

      for (const row of rows) {
        if (row.document_key in nextMap) {
          nextMap[row.document_key] = row;
        }
      }

      setRowsByKey(nextMap);
      setDraft(toDraft(selectedKey, nextMap[selectedKey]));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load legal documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  const handleSelect = (key: LegalDocumentKey) => {
    setSelectedKey(key);
    setDraft(toDraft(key, rowsByKey[key]));
    setSavedAt(null);
    setError(null);
  };

  const handleSave = async () => {
    if (!draft.title.trim()) {
      setError("Title is required.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const saved = await upsertLegalDocument({
        key: draft.key,
        title: draft.title,
        content: draft.content,
      });

      setRowsByKey((prev) => ({ ...prev, [draft.key]: saved }));
      setSavedAt(saved.updated_at);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save legal document.");
    } finally {
      setSaving(false);
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
    <AdminLayout title="Admin · Legal Documents">
      <div className="mb-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[12px] text-gray-500 mb-2">Select document</div>
        <div className="flex gap-2 overflow-x-auto">
          {LEGAL_DOCUMENT_DEFINITIONS.map((item) => {
            const active = item.key === selectedKey;
            return (
              <button
                key={item.key}
                onClick={() => handleSelect(item.key)}
                className={`px-3 py-1.5 rounded-full border text-[12px] whitespace-nowrap ${
                  active ? "bg-gray-900 text-white border-gray-900" : "bg-white text-gray-700 border-gray-200"
                }`}
              >
                {item.title}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        {loading ? <div className="text-[13px] text-gray-500">Loading legal documents…</div> : null}

        {!loading ? (
          <>
            <label className="text-[12px] text-gray-500">Title</label>
            <input
              value={draft.title}
              onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
              className="mt-1 mb-3 w-full h-10 rounded-xl border border-gray-200 px-3 text-[13px] outline-none focus:border-gray-400"
            />

            <label className="text-[12px] text-gray-500">Content</label>
            <textarea
              value={draft.content}
              onChange={(event) => setDraft((prev) => ({ ...prev, content: event.target.value }))}
              rows={18}
              placeholder="Paste full legal document text here..."
              className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-[13px] leading-5 outline-none focus:border-gray-400"
            />

            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="text-[11px] text-gray-500">
                {savedAt
                  ? `Saved ${new Date(savedAt).toLocaleString()}`
                  : selectedRow?.updated_at
                    ? `Last update ${new Date(selectedRow.updated_at).toLocaleString()}`
                    : "Not saved yet"}
              </div>
              <button
                disabled={saving}
                onClick={() => void handleSave()}
                className="h-10 px-4 rounded-xl bg-gray-900 text-white text-[13px] disabled:opacity-70"
              >
                {saving ? "Saving..." : "Save document"}
              </button>
            </div>

            {error ? <div className="mt-2 text-[12px] text-rose-600">{error}</div> : null}
            <div className="mt-2 text-[11px] text-gray-400">
              This updates the content users see under {selectedDefinition.title}.
            </div>
          </>
        ) : null}
      </div>
    </AdminLayout>
  );
}
