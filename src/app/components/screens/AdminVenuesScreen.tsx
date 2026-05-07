import { useEffect, useMemo, useState } from "react";
import {
  adminDeleteRating,
  adminDeleteRatingNote,
  adminRestoreRating,
  adminRevokeRating,
  getAdminPlaceActivity,
  getAdminRatedVenues,
} from "@/lib/services/admin";
import type { AdminRatedVenue, AdminVenueRatingActivity } from "@/types/admin";
import { AdminLayout } from "./admin/AdminLayout";
import { useAdminGuard } from "./admin/useAdminGuard";

export function AdminVenuesScreen() {
  const { loading: guardLoading, allowed } = useAdminGuard();
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [venuesLoading, setVenuesLoading] = useState(true);
  const [venuesError, setVenuesError] = useState<string | null>(null);
  const [venues, setVenues] = useState<AdminRatedVenue[]>([]);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [activity, setActivity] = useState<AdminVenueRatingActivity[]>([]);
  const [busyRatingId, setBusyRatingId] = useState<string | null>(null);

  const filteredVenues = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return venues;
    return venues.filter((venue) => {
      const haystack = [venue.place_name, venue.city, venue.country, venue.address ?? "", venue.venue_type]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [search, venues]);

  const selectedVenue = useMemo(
    () => filteredVenues.find((venue) => venue.place_id === selectedVenueId) ?? null,
    [filteredVenues, selectedVenueId],
  );

  const loadVenues = async () => {
    setVenuesLoading(true);
    setVenuesError(null);
    try {
      const data = await getAdminRatedVenues(300, 0);
      setVenues(data);
      if (!selectedVenueId && data.length > 0) {
        setSelectedVenueId(data[0].place_id);
      }
      if (selectedVenueId && !data.some((item) => item.place_id === selectedVenueId)) {
        setSelectedVenueId(data[0]?.place_id ?? null);
      }
    } catch (loadError) {
      setVenuesError(loadError instanceof Error ? loadError.message : "Failed to load venues.");
    } finally {
      setVenuesLoading(false);
    }
  };

  const loadActivity = async (placeId: string) => {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const data = await getAdminPlaceActivity(placeId, 500);
      setActivity(data);
    } catch (loadError) {
      setActivityError(loadError instanceof Error ? loadError.message : "Failed to load venue activity.");
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (!allowed) return;
    void loadVenues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed]);

  useEffect(() => {
    if (!selectedVenueId || !allowed) return;
    void loadActivity(selectedVenueId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVenueId, allowed]);

  useEffect(() => {
    if (filteredVenues.length === 0) {
      setSelectedVenueId(null);
      return;
    }
    if (!selectedVenueId || !filteredVenues.some((venue) => venue.place_id === selectedVenueId)) {
      setSelectedVenueId(filteredVenues[0].place_id);
    }
  }, [filteredVenues, selectedVenueId]);

  const mutateRating = async (ratingId: string, fn: () => Promise<void>) => {
    setBusyRatingId(ratingId);
    try {
      await fn();
      if (selectedVenueId) {
        await loadActivity(selectedVenueId);
        await loadVenues();
      }
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
    <AdminLayout title="Admin · Venues">
      {venuesError ? (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[12px] text-rose-700">{venuesError}</div>
      ) : null}

      <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="mb-2 flex gap-2">
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Search venue, city, address, type"
            className="flex-1 h-10 rounded-xl border border-gray-200 px-3 text-[13px] outline-none focus:border-gray-400"
          />
          <button
            onClick={() => setSearch(searchDraft.trim())}
            className="h-10 px-3 rounded-xl border border-gray-300 bg-white text-[12px] text-gray-700"
          >
            Search
          </button>
        </div>
        <div className="text-[12px] text-gray-500 mb-2">Rated venues</div>
        {venuesLoading ? (
          <div className="text-[13px] text-gray-500">Loading venues…</div>
        ) : filteredVenues.length === 0 ? (
          <div className="text-[13px] text-gray-500">No venues match this search.</div>
        ) : venues.length === 0 ? (
          <div className="text-[13px] text-gray-500">No rated venues yet.</div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {filteredVenues.map((venue) => {
              const selected = venue.place_id === selectedVenueId;
              return (
                <button
                  key={venue.place_id}
                  onClick={() => setSelectedVenueId(venue.place_id)}
                  className={`w-full rounded-xl border px-3 py-2 text-left ${
                    selected ? "border-gray-900 bg-gray-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="text-[13px] text-gray-900">{venue.place_name}</div>
                  <div className="text-[11px] text-gray-500">
                    {venue.city} · {venue.rating_count} total ratings · {venue.note_count} notes
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-3 rounded-2xl border border-gray-100 bg-white p-3 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <div className="text-[12px] text-gray-500 mb-2">
          {selectedVenue ? `Activity for ${selectedVenue.place_name}` : "Venue activity"}
        </div>
        {activityError ? <div className="mb-2 text-[12px] text-rose-600">{activityError}</div> : null}
        {!selectedVenue ? (
          <div className="text-[13px] text-gray-500">Select a venue.</div>
        ) : activityLoading ? (
          <div className="text-[13px] text-gray-500">Loading ratings and notes…</div>
        ) : activity.length === 0 ? (
          <div className="text-[13px] text-gray-500">No activity found for this venue.</div>
        ) : (
          <div className="space-y-2 max-h-[48vh] overflow-y-auto pr-1">
            {activity.map((row) => {
              const busy = busyRatingId === row.rating_id;
              return (
                <div key={row.rating_id} className="rounded-xl border border-gray-200 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[12px] text-gray-900">
                      @{row.username} · {row.user_email ?? "no-email"}
                    </div>
                    <div className={`text-[11px] ${row.rating_status === "active" ? "text-emerald-700" : "text-rose-700"}`}>
                      {row.rating_status}
                    </div>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    {new Date(row.updated_at).toLocaleString()} · votes {row.upvotes}/{row.downvotes} · flags {row.flag_count}
                  </div>
                  {row.note ? <div className="mt-1 text-[12px] text-gray-700">{row.note}</div> : null}
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
                        Revoke
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => void mutateRating(row.rating_id, () => adminRestoreRating(row.rating_id))}
                        className="rounded-full border border-emerald-200 px-2 py-0.5 text-[11px] text-emerald-700 disabled:opacity-50"
                      >
                        Restore
                      </button>
                    )}
                    <button
                      disabled={busy || !row.note}
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
