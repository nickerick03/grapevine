import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { WarningCircle } from "@phosphor-icons/react";
import { getAdminDashboardTotals } from "@/lib/services/admin";
import type { AdminDashboardTotals } from "@/types/admin";
import { AdminLayout } from "./admin/AdminLayout";
import { useAdminGuard } from "./admin/useAdminGuard";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-1 text-[20px] text-gray-900">{value}</div>
    </div>
  );
}

export function AdminOverviewScreen() {
  const navigate = useNavigate();
  const { loading: guardLoading, allowed } = useAdminGuard();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<AdminDashboardTotals | null>(null);

  useEffect(() => {
    if (!allowed) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void getAdminDashboardTotals()
      .then((data) => {
        if (!cancelled) {
          setTotals(data);
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Failed to load admin totals.");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [allowed]);

  if (guardLoading || !allowed) {
    return (
      <div className="absolute inset-0 bg-[#fbf8f3] flex items-center justify-center text-[13px] text-gray-500">
        Checking access…
      </div>
    );
  }

  return (
    <AdminLayout title="Admin">
      {error ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">
          {error}
        </div>
      ) : null}

      {loading || !totals ? (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 text-[13px] text-gray-500">
          Loading admin dashboard…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <StatCard label="Total places" value={totals.total_places} />
            <StatCard label="Rated venues" value={totals.rated_venues} />
            <StatCard label="Active ratings" value={totals.active_ratings} />
            <StatCard label="Revoked ratings" value={totals.revoked_ratings} />
            <StatCard label="Notes" value={totals.notes_count} />
            <StatCard label="Users" value={totals.users_total} />
            <StatCard label="Frozen users" value={totals.users_frozen} />
            <StatCard label="Open bugs" value={totals.bug_reports_open} />
          </div>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2 text-[12px] text-amber-800">
            <WarningCircle size={16} weight="fill" className="mt-0.5 flex-none" />
            <p>Hard account deletion is two-step: freeze first, then permanent delete from Users.</p>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-2">
            <button
              onClick={() => navigate("/admin/cups")}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-[13px] text-gray-800"
            >
              Cup Maker: create, activate, finalize, and manage rewards
            </button>
            <button
              onClick={() => navigate("/admin/venues")}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-[13px] text-gray-800"
            >
              Manage rated venues, ratings, and notes
            </button>
            <button
              onClick={() => navigate("/admin/users")}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-[13px] text-gray-800"
            >
              Manage users, scores, freeze state, and deletion
            </button>
            <button
              onClick={() => navigate("/admin/bugs")}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-[13px] text-gray-800"
            >
              Triage bug reports
            </button>
            <button
              onClick={() => navigate("/admin/legal")}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-[13px] text-gray-800"
            >
              Edit legal pages content
            </button>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
