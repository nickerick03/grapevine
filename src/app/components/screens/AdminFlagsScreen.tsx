import { useEffect, useState } from "react";
import {
  adminUpdateUserProfileReport,
  adminClearNoteFlags,
  adminDeleteRating,
  adminDeleteRatingNote,
  adminRestoreRating,
  adminRevokeRating,
  adminSetUserFrozen,
  getAdminFlaggedNotes,
  getAdminUserProfileReports,
} from "@/lib/services/admin";
import type { AdminFlaggedNoteRow, AdminUserProfileReportRow, UserProfileReportStatus } from "@/types/admin";
import { AdminLayout } from "./admin/AdminLayout";
import { useAdminGuard } from "./admin/useAdminGuard";

export function AdminFlagsScreen() {
  const { loading: guardLoading, allowed } = useAdminGuard();
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [loadingFlags, setLoadingFlags] = useState(true);
  const [loadingUserReports, setLoadingUserReports] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<AdminFlaggedNoteRow[]>([]);
  const [userReports, setUserReports] = useState<AdminUserProfileReportRow[]>([]);
  const [reportStatusFilter, setReportStatusFilter] = useState<UserProfileReportStatus | "all">("open");
  const [busyRatingId, setBusyRatingId] = useState<string | null>(null);
  const [busyReportId, setBusyReportId] = useState<string | null>(null);

  const loadRows = async (search = query) => {
    setLoadingFlags(true);
    setError(null);
    try {
      const data = await getAdminFlaggedNotes(600, 0, search);
      setRows(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load flagged notes.");
    } finally {
      setLoadingFlags(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, query]);

  const loadUserReports = async (search = query, status = reportStatusFilter) => {
    setLoadingUserReports(true);
    setError(null);
    try {
      const data = await getAdminUserProfileReports(600, 0, search, status);
      setUserReports(data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load user reports.");
    } finally {
      setLoadingUserReports(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void loadUserReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, query, reportStatusFilter]);

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

  const mutateUserReport = async (reportId: string, status: UserProfileReportStatus) => {
    setBusyReportId(reportId);
    try {
      await adminUpdateUserProfileReport(reportId, { status });
      await loadUserReports();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusyReportId(null);
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
          <select
            value={reportStatusFilter}
            onChange={(event) => setReportStatusFilter(event.target.value as UserProfileReportStatus | "all")}
            className="h-10 rounded-xl border border-gray-300 bg-white px-2 text-[12px] text-gray-700"
          >
            <option value="all">All reports</option>
            <option value="open">Open</option>
            <option value="reviewed">Reviewed</option>
            <option value="dismissed">Dismissed</option>
            <option value="resolved">Resolved</option>
          </select>
        </div>
        {error ? <div className="mt-2 text-[12px] text-rose-600">{error}</div> : null}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3 mb-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="mb-2 text-[13px] text-gray-900">User profile reports</div>
        {loadingUserReports ? (
          <div className="text-[13px] text-gray-500">Loading user reports…</div>
        ) : userReports.length === 0 ? (
          <div className="text-[13px] text-gray-500">No user reports.</div>
        ) : (
          <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
            {userReports.map((row) => {
              const busy = busyReportId === row.id;
              return (
                <div key={row.id} className="rounded-xl border border-gray-200 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] text-gray-900 truncate">
                        @{row.reported_username} reported by @{row.reporter_username}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate">
                        {new Date(row.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800">
                      {row.status}
                    </span>
                  </div>
                  {row.reason ? <div className="mt-1 text-[11px] text-gray-700">Reason: {row.reason}</div> : null}
                  {row.message ? <div className="mt-1 text-[12px] text-gray-700 whitespace-pre-wrap">{row.message}</div> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      disabled={busy}
                      onClick={() => void mutateUserReport(row.id, "reviewed")}
                      className="rounded-full border border-blue-200 px-2 py-0.5 text-[11px] text-blue-700 disabled:opacity-50"
                    >
                      Mark reviewed
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void mutateUserReport(row.id, "dismissed")}
                      className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-700 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void mutateUserReport(row.id, "resolved")}
                      className="rounded-full border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-700 disabled:opacity-50"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="mb-2 text-[13px] text-gray-900">Flagged notes</div>
        {loadingFlags ? (
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
                  {row.reasons && row.reasons.length > 0 ? (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {row.reasons.map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] text-amber-800"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {row.latest_details ? (
                    <div className="mt-1 text-[11px] text-gray-600">
                      Latest details: {row.latest_details}
                    </div>
                  ) : null}
                  <div className="mt-1 text-[11px] text-gray-600">
                    Rating · C/M {row.classic_modern} · Q/L {row.quiet_lively} · I/M {row.cheap_premium}
                    {" · "}L/T {row.local_touristy} · C/S {row.cozy_spacious}
                    {typeof row.price_range === "number" ? ` · Price ${row.price_range}` : ""}
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
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Freeze this user account?")) {
                          void mutateRating(row.rating_id, () => adminSetUserFrozen(row.user_id, true));
                        }
                      }}
                      className="rounded-full border border-indigo-200 px-2 py-0.5 text-[11px] text-indigo-700 disabled:opacity-50"
                    >
                      Freeze user
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm("Ignore this report? This clears flag notifications but keeps note and rating.")) {
                          void mutateRating(row.rating_id, () => adminClearNoteFlags(row.rating_id));
                        }
                      }}
                      className="rounded-full border border-slate-300 px-2 py-0.5 text-[11px] text-slate-700 disabled:opacity-50"
                    >
                      Ignore
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
