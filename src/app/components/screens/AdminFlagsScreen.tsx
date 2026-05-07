import { useEffect, useState } from "react";
import {
  adminDeleteRating,
  adminDeleteRatingNote,
  adminRestoreRating,
  adminRevokeRating,
  getAdminFlaggedNotes,
} from "@/lib/services/admin";
import type { AdminFlaggedNoteRow } from "@/types/admin";
import { AdminLayout } from "./admin/AdminLayout";
import { useAdminGuard } from "./admin/useAdminGuard";

export function AdminFlagsScreen() {
  const { loading: guardLoading, allowed } = useAdminGuard();
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminFlaggedNoteRow[]>([]);
  const [busyRatingId, setBusyRatingId] = useState<string | null>(null);

  const loadRows = async (search = query) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAdminFlaggedNotes(600, 0, search);
      setRows(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load flagged notes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, query]);

  const mutateRating = async (ratingId: string, fn: () => Promise<void>) => {
    setBusyRatingId(ratingId);
    try {
      await fn();
      await loadRows();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyRatingId(null);
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
    <AdminLayout title="Admin · Flags">
      <div className="mb-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex gap-2">
          <input
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder="Search place, city, username, note"
            className="flex-1 h-10 rounded-xl border border-gray-200 px-3 text-[13px] outline-none focus:border-gray-400"
          />
          <button
            onClick={() => setQuery(queryDraft.trim())}
            className="h-10 px-3 rounded-xl border border-gray-300 bg-white text-[12px] text-gray-700"
          >
            Search
          </button>
        </div>
        {error ? <div className="mt-2 text-[12px] text-rose-600">{error}</div> : null}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        {loading ? (
          <div className="text-[13px] text-gray-500">Loading flagged notes…</div>
        ) : rows.length === 0 ? (
          <div className="text-[13px] text-gray-500">No flagged notes.</div>
        ) : (
          <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
            {rows.map((row) => {
              const busy = busyRatingId === row.rating_id;
              return (
                <div key={row.rating_id} className="rounded-xl border border-gray-200 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] text-gray-900 truncate">{row.place_name}</div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {row.place_city} · @{row.username} · {row.user_email ?? "no-email"}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] text-rose-700">
                        {row.flag_count} flags
                      </span>
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${row.rating_status === "active" ? "border-emerald-200 text-emerald-700" : "border-amber-200 text-amber-700"}`}>
                        {row.rating_status}
                      </span>
                    </div>
                  </div>

                  <p className="mt-1 text-[12px] text-gray-700 whitespace-pre-wrap">{row.note}</p>
                  <div className="mt-1 text-[11px] text-gray-500">
                    Last flagged: {new Date(row.last_flagged_at).toLocaleString()}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {row.rating_status === "active" ? (
                      <button
                        disabled={busy}
                        onClick={() => {
                          const reason = window.prompt("Revocation reason (optional):", "") ?? "";
                          void mutateRating(row.rating_id, () => adminRevokeRating(row.rating_id, reason));
                        }}
                        className="rounded-full border border-rose-200 px-2 py-0.5 text-[11px] text-rose-700 disabled:opacity-50"
                      >
                        Revoke rating
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => void mutateRating(row.rating_id, () => adminRestoreRating(row.rating_id))}
                        className="rounded-full border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-700 disabled:opacity-50"
                      >
                        Restore rating
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Delete this note text?")) {
                          void mutateRating(row.rating_id, () => adminDeleteRatingNote(row.rating_id));
                        }
                      }}
                      className="rounded-full border border-amber-200 px-2 py-0.5 text-[11px] text-amber-700 disabled:opacity-50"
                    >
                      Delete note
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Delete this whole rating permanently?")) {
                          void mutateRating(row.rating_id, () => adminDeleteRating(row.rating_id));
                        }
                      }}
                      className="rounded-full border border-gray-300 px-2 py-0.5 text-[11px] text-gray-700 disabled:opacity-50"
                    >
                      Delete rating
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
