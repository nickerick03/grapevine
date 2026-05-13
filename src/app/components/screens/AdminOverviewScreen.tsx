import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { WarningCircle } from "@phosphor-icons/react";
import { getAdminDashboardTotals } from "@/lib/services/admin";
import type { AdminDashboardTotals } from "@/types/admin";
import { AdminLayout, useAdminBadgeContext } from "./admin/AdminLayout";
import { useAdminGuard } from "./admin/useAdminGuard";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
      <div className="text-[11px] text-gray-500">{label}</div>
      <div className="mt-1 text-[20px] text-gray-900">{value}</div>
    </div>
  );
}

function AdminActionCard({
  label,
  hasNew,
  onClick,
}: {
  label: string;
  hasNew?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="relative rounded-xl border border-gray-200 bg-white px-3 py-2 text-left text-[13px] text-gray-800"
    >
      {hasNew ? <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" aria-hidden="true" /> : null}
      {label}
    </button>
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
      <AdminOverviewContent
        loading={loading}
        error={error}
        totals={totals}
        onNavigate={navigate}
      />
    </AdminLayout>
  );
}

function AdminOverviewContent({
  loading,
  error,
  totals,
  onNavigate,
}: {
  loading: boolean;
  error: string | null;
  totals: AdminDashboardTotals | null;
  onNavigate: (path: string) => void;
}) {
  const { badges } = useAdminBadgeContext();

  return (
    <>
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
            <AdminActionCard
              hasNew={badges.cups}
              onClick={() => onNavigate("/admin/cups")}
              label="Cup Maker: create, activate, finalize, and manage rewards"
            />
            <AdminActionCard
              hasNew={badges.venues}
              onClick={() => onNavigate("/admin/venues")}
              label="Manage rated venues, ratings, and notes"
            />
            <AdminActionCard
              hasNew={badges.users}
              onClick={() => onNavigate("/admin/users")}
              label="Manage users, scores, freeze state, and deletion"
            />
            <AdminActionCard
              hasNew={badges.flags}
              onClick={() => onNavigate("/admin/flags")}
              label="Review flagged notes"
            />
            <AdminActionCard
              hasNew={badges.bugs}
              onClick={() => onNavigate("/admin/bugs")}
              label="Triage bug reports"
            />
            <AdminActionCard
              hasNew={badges.legal}
              onClick={() => onNavigate("/admin/legal")}
              label="Edit legal pages content"
            />
          </div>
        </>
      )}
    </>
  );
}
