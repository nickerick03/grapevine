import { useCallback, useEffect, useMemo, useState } from "react";
import { getAdminBugReports, getAdminFlaggedNotes, getAdminRatedVenues, getAdminUsers } from "@/lib/services/admin";
import { getAdminCups } from "@/lib/services/cups";
import { listLegalDocuments } from "@/lib/services/legal";

export type AdminBadgeSection = "cups" | "venues" | "users" | "flags" | "legal" | "bugs";

export type AdminBadgeMap = Record<AdminBadgeSection, boolean>;

type SeenMap = Record<AdminBadgeSection, number>;
type LatestMap = Record<AdminBadgeSection, number>;

const STORAGE_KEY = "grapevine_admin_seen_v1";

const EMPTY_BADGES: AdminBadgeMap = {
  cups: false,
  venues: false,
  users: false,
  flags: false,
  legal: false,
  bugs: false,
};

const EMPTY_SEEN: SeenMap = {
  cups: 0,
  venues: 0,
  users: 0,
  flags: 0,
  legal: 0,
  bugs: 0,
};

const EMPTY_LATEST: LatestMap = {
  cups: 0,
  venues: 0,
  users: 0,
  flags: 0,
  legal: 0,
  bugs: 0,
};

function parseTimestamp(value: string | null | undefined): number {
  if (!value) return 0;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function maxTs(values: Array<string | null | undefined>): number {
  let max = 0;
  for (const value of values) {
    max = Math.max(max, parseTimestamp(value));
  }
  return max;
}

function loadSeenFromStorage(): SeenMap {
  if (typeof window === "undefined") return EMPTY_SEEN;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_SEEN;
    const parsed = JSON.parse(raw) as Partial<Record<AdminBadgeSection, number>>;
    return {
      cups: typeof parsed.cups === "number" ? parsed.cups : 0,
      venues: typeof parsed.venues === "number" ? parsed.venues : 0,
      users: typeof parsed.users === "number" ? parsed.users : 0,
      flags: typeof parsed.flags === "number" ? parsed.flags : 0,
      legal: typeof parsed.legal === "number" ? parsed.legal : 0,
      bugs: typeof parsed.bugs === "number" ? parsed.bugs : 0,
    };
  } catch {
    return EMPTY_SEEN;
  }
}

function persistSeenToStorage(seen: SeenMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seen));
}

function toBadges(seen: SeenMap, latest: LatestMap): AdminBadgeMap {
  return {
    cups: latest.cups > seen.cups,
    venues: latest.venues > seen.venues,
    users: latest.users > seen.users,
    flags: latest.flags > seen.flags,
    legal: latest.legal > seen.legal,
    bugs: latest.bugs > seen.bugs,
  };
}

export function useAdminBadges() {
  const [latest, setLatest] = useState<LatestMap>(EMPTY_LATEST);
  const [seen, setSeen] = useState<SeenMap>(EMPTY_SEEN);

  useEffect(() => {
    setSeen(loadSeenFromStorage());
  }, []);

  const refreshBadges = useCallback(async () => {
    const [cups, venues, users, flags, legalDocs, bugs] = await Promise.all([
      getAdminCups(),
      getAdminRatedVenues(250, 0),
      getAdminUsers(250, 0),
      getAdminFlaggedNotes(250, 0),
      listLegalDocuments(),
      getAdminBugReports("open"),
    ]);

    setLatest({
      cups: maxTs(cups.map((entry) => entry.updatedAt || entry.createdAt || null)),
      venues: maxTs(venues.map((entry) => entry.last_rating_at || null)),
      users: maxTs(users.map((entry) => entry.updated_at || entry.created_at || null)),
      flags: maxTs(flags.map((entry) => entry.last_flagged_at || entry.updated_at || null)),
      legal: maxTs(legalDocs.map((entry) => entry.updated_at || null)),
      bugs: maxTs(bugs.map((entry) => entry.updated_at || entry.created_at || null)),
    });
  }, []);

  const markSeen = useCallback((section: AdminBadgeSection) => {
    setSeen((previous) => {
      const nextValue = Math.max(previous[section], latest[section], Date.now());
      const next: SeenMap = { ...previous, [section]: nextValue };
      persistSeenToStorage(next);
      return next;
    });
  }, [latest]);

  const badges = useMemo(() => toBadges(seen, latest), [latest, seen]);

  const hasAnyNew =
    badges.cups || badges.venues || badges.users || badges.flags || badges.legal || badges.bugs;

  return {
    badges,
    hasAnyNew,
    refreshBadges,
    markSeen,
  };
}
