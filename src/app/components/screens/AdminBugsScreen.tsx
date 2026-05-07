import { useEffect, useState } from "react";
import {
  deleteAdminBugReport,
  getAdminBugReports,
  type AdminBugReportListItem,
  updateAdminBugReport,
} from "@/lib/services/admin";
import type { BugReportStatus } from "@/types/admin";
import { useAuth } from "@/app/context/AuthContext";
import { AdminLayout } from "./admin/AdminLayout";
import { useAdminGuard } from "./admin/useAdminGuard";

const STATUS_OPTIONS: Array<{ label: string; value: BugReportStatus | "all" }> = [
  { label: "All", value: "all" },
  { label: "Open", value: "open" },
  { label: "Triaged", value: "triaged" },
  { label: "In progress", value: "in_progress" },
  { label: "Resolved", value: "resolved" },
  { label: "Dismissed", value: "dismissed" },
];

export function AdminBugsScreen() {
  const { user } = useAuth();
  const { loading: guardLoading, allowed } = useAdminGuard();
  const [status, setStatus] = useState<BugReportStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<AdminBugReportListItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadItems = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getAdminBugReports(status);
      setItems(rows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load bug reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, status]);

  const updateStatus = async (id: string, nextStatus: BugReportStatus) => {
    setBusyId(id);
    try {
      await updateAdminBugReport(id, { status: nextStatus }, user?.id);
      await loadItems();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to update report.");
    } finally {
      setBusyId(null);
    }
  };

  const updateAdminNote = async (id: string, current: string | null) => {
    const value = window.prompt("Admin note", current ?? "");
    if (value === null) return;
    setBusyId(id);
    try {
      await updateAdminBugReport(id, { admin_note: value }, user?.id);
      await loadItems();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to update admin note.");
    } finally {
      setBusyId(null);
    }
  };

  const removeItem = async (id: string) => {
    if (!window.confirm("Delete this bug report?")) return;
    setBusyId(id);
    try {
      await deleteAdminBugReport(id);
      await loadItems();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to delete report.");
    } finally {
      setBusyId(null);
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
    <AdminLayout title="Admin · Bug Reports">
      <div className="mb-3 flex gap-2 overflow-x-auto">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setStatus(option.value)}
            className={`px-3 py-1.5 rounded-full border text-[12px] whitespace-nowrap ${
              status === option.value
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        {loading ? (
          <div className="text-[13px] text-gray-500">Loading bug reports…</div>
        ) : items.length === 0 ? (
          <div className="text-[13px] text-gray-500">No bug reports in this state.</div>
        ) : (
          <div className="space-y-2 max-h-[72vh] overflow-y-auto pr-1">
            {items.map((item) => {
              const busy = busyId === item.id;
              return (
                <div key={item.id} className="rounded-xl border border-gray-200 p-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[13px] text-gray-900">{item.title}</div>
                      <div className="text-[11px] text-gray-500">
                        Reporter: {item.reporter_id.slice(0, 8)}… · {new Date(item.created_at).toLocaleString()}
                      </div>
                    </div>
                    <span className="rounded-full border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600">
                      {item.status}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] text-gray-700 whitespace-pre-wrap">{item.description}</p>
                  {item.page_route ? <div className="mt-1 text-[11px] text-gray-500">Route: {item.page_route}</div> : null}
                  {item.screenshot_url ? (
                    <a
                      href={item.screenshot_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-block text-[11px] text-blue-600 underline break-all"
                    >
                      Screenshot link
                    </a>
                  ) : null}
                  {item.admin_note ? <div className="mt-1 text-[11px] text-gray-600">Admin note: {item.admin_note}</div> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    <button
                      disabled={busy}
                      onClick={() => void updateStatus(item.id, "triaged")}
                      className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-700 disabled:opacity-50"
                    >
                      Triaged
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void updateStatus(item.id, "in_progress")}
                      className="rounded-full border border-gray-200 px-2 py-0.5 text-[11px] text-gray-700 disabled:opacity-50"
                    >
                      In progress
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void updateStatus(item.id, "resolved")}
                      className="rounded-full border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-700 disabled:opacity-50"
                    >
                      Resolved
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void updateStatus(item.id, "dismissed")}
                      className="rounded-full border border-amber-200 px-2 py-0.5 text-[11px] text-amber-700 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void updateAdminNote(item.id, item.admin_note)}
                      className="rounded-full border border-blue-200 px-2 py-0.5 text-[11px] text-blue-700 disabled:opacity-50"
                    >
                      Admin note
                    </button>
                    <button
                      disabled={busy}
                      onClick={() => void removeItem(item.id)}
                      className="rounded-full border border-rose-200 px-2 py-0.5 text-[11px] text-rose-700 disabled:opacity-50"
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
    </AdminLayout>
  );
}
