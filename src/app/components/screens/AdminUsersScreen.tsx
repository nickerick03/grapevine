import { useEffect, useMemo, useState } from "react";
import {
  adminDeleteRating,
  adminDeleteRatingNote,
  adminRestoreRating,
  adminRevokeRating,
  adminSetUserFrozen,
  getAdminUserActivity,
  getAdminUsers,
  hardDeleteUser,
} from "@/lib/services/admin";
import type { AdminUserActivityRow, AdminUserRow } from "@/types/admin";
import { AdminLayout } from "./admin/AdminLayout";
import { useAdminGuard } from "./admin/useAdminGuard";

export function AdminUsersScreen() {
  const { loading: guardLoading, allowed } = useAdminGuard();
  const [query, setQuery] = useState("");
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activity, setActivity] = useState<AdminUserActivityRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const selectedUser = useMemo(
    () => users.find((entry) => entry.user_id === selectedUserId) ?? null,
    [users, selectedUserId],
  );

  const loadUsers = async (search = query) => {
    setUsersLoading(true);
    setUsersError(null);
    try {
      const rows = await getAdminUsers(400, 0, search);
      setUsers(rows);
      if (!selectedUserId && rows.length > 0) {
        setSelectedUserId(rows[0].user_id);
      }
      if (selectedUserId && !rows.some((entry) => entry.user_id === selectedUserId)) {
        setSelectedUserId(rows[0]?.user_id ?? null);
      }
    } catch (err) {
      setUsersError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setUsersLoading(false);
    }
  };

  const loadActivity = async (userId: string) => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const rows = await getAdminUserActivity(userId, 600);
      setActivity(rows);
    } catch (err) {
      setActivityError(err instanceof Error ? err.message : "Failed to load user activity.");
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void loadUsers("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  useEffect(() => {
    if (!allowed || !selectedUserId) return;
    void loadActivity(selectedUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, selectedUserId]);

  const runAction = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    try {
      await action();
      await loadUsers(query);
      if (selectedUserId) {
        await loadActivity(selectedUserId);
      }
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setBusy(null);
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
    <AdminLayout title="Admin · Users">
      <div className="mb-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search email / username / city"
            className="flex-1 h-10 rounded-xl border border-gray-200 px-3 text-[13px] outline-none focus:border-gray-400"
          />
          <button
            onClick={() => void loadUsers(query)}
            className="h-10 px-3 rounded-xl border border-gray-300 bg-white text-[12px] text-gray-700"
          >
            Search
          </button>
        </div>
        {usersError ? <div className="mt-2 text-[12px] text-rose-600">{usersError}</div> : null}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[12px] text-gray-500 mb-2">Users</div>
        {usersLoading ? (
          <div className="text-[13px] text-gray-500">Loading users…</div>
        ) : users.length === 0 ? (
          <div className="text-[13px] text-gray-500">No users found.</div>
        ) : (
          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {users.map((entry) => (
              <button
                key={entry.user_id}
                onClick={() => setSelectedUserId(entry.user_id)}
                className={`w-full rounded-xl border p-2 text-left ${
                  entry.user_id === selectedUserId ? "border-gray-900 bg-gray-50" : "border-gray-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[13px] text-gray-900 truncate">{entry.username}</div>
                  <div className="text-[11px] text-gray-500">{entry.grapevine_score.toFixed(1)} pts</div>
                </div>
                <div className="text-[11px] text-gray-500 truncate">{entry.email ?? "no-email"}</div>
                <div className="text-[11px] text-gray-500">
                  {entry.city || "No city"} · {entry.reviews_submitted} reviews · {entry.notes_submitted} notes
                </div>
                <div className="text-[10px] text-gray-400">
                  Last sign in: {entry.last_sign_in_at ? new Date(entry.last_sign_in_at).toLocaleString() : "never"}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[12px] text-gray-500 mb-2">Selected user controls</div>
        {!selectedUser ? (
          <div className="text-[13px] text-gray-500">Select a user first.</div>
        ) : (
          <>
            <div className="text-[13px] text-gray-900">{selectedUser.username}</div>
            <div className="text-[11px] text-gray-500">{selectedUser.email ?? "no-email"}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              <button
                disabled={busy !== null || selectedUser.role === "super_admin"}
                onClick={() =>
                  void runAction(
                    `freeze:${selectedUser.user_id}`,
                    () => adminSetUserFrozen(selectedUser.user_id, !selectedUser.is_frozen),
                  )
                }
                className="rounded-full border border-amber-200 px-2 py-0.5 text-[11px] text-amber-700 disabled:opacity-50"
              >
                {selectedUser.is_frozen ? "Unfreeze account" : "Freeze account"}
              </button>
              <button
                disabled={busy !== null || !selectedUser.is_frozen || selectedUser.role === "super_admin"}
                onClick={() => {
                  if (!window.confirm("Hard-delete this frozen user permanently? This cannot be undone.")) return;
                  void runAction(`delete-user:${selectedUser.user_id}`, () => hardDeleteUser(selectedUser.user_id));
                }}
                className="rounded-full border border-rose-200 px-2 py-0.5 text-[11px] text-rose-700 disabled:opacity-50"
              >
                Hard delete user
              </button>
            </div>
            {selectedUser.role === "super_admin" ? (
              <div className="mt-1 text-[10px] text-gray-400">Super-admin account protection is active.</div>
            ) : null}
            {!selectedUser.is_frozen ? (
              <div className="mt-1 text-[10px] text-gray-400">Freeze is required before hard delete.</div>
            ) : null}
          </>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[12px] text-gray-500 mb-2">User ratings and notes</div>
        {activityError ? <div className="mb-2 text-[12px] text-rose-600">{activityError}</div> : null}
        {!selectedUser ? (
          <div className="text-[13px] text-gray-500">Select a user to inspect activity.</div>
        ) : activityLoading ? (
          <div className="text-[13px] text-gray-500">Loading user activity…</div>
        ) : activity.length === 0 ? (
          <div className="text-[13px] text-gray-500">No ratings found for this user.</div>
        ) : (
          <div className="space-y-2 max-h-[44vh] overflow-y-auto pr-1">
            {activity.map((row) => {
              const rowBusy = busy === row.rating_id;
              return (
                <div key={row.rating_id} className="rounded-xl border border-gray-200 p-2">
                  <div className="text-[13px] text-gray-900">{row.place_name}</div>
                  <div className="text-[11px] text-gray-500">{row.place_city} · {row.rating_status}</div>
                  {row.note ? <div className="mt-1 text-[12px] text-gray-700">{row.note}</div> : null}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {row.rating_status === "active" ? (
                      <button
                        disabled={rowBusy}
                        onClick={() => {
                          const reason = window.prompt("Revocation reason (optional):", "") ?? "";
                          void runAction(row.rating_id, () => adminRevokeRating(row.rating_id, reason));
                        }}
                        className="rounded-full border border-rose-200 px-2 py-0.5 text-[11px] text-rose-700 disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    ) : (
                      <button
                        disabled={rowBusy}
                        onClick={() => void runAction(row.rating_id, () => adminRestoreRating(row.rating_id))}
                        className="rounded-full border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-700 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    )}
                    <button
                      disabled={rowBusy || !row.note}
                      onClick={() => {
                        if (window.confirm("Delete note text from this rating?")) {
                          void runAction(row.rating_id, () => adminDeleteRatingNote(row.rating_id));
                        }
                      }}
                      className="rounded-full border border-amber-200 px-2 py-0.5 text-[11px] text-amber-700 disabled:opacity-50"
                    >
                      Delete note
                    </button>
                    <button
                      disabled={rowBusy}
                      onClick={() => {
                        if (window.confirm("Delete this whole rating permanently?")) {
                          void runAction(row.rating_id, () => adminDeleteRating(row.rating_id));
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
