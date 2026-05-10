import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase/client";
import type {
  AdminDashboardTotals,
  AdminFlaggedNoteRow,
  AdminRatedVenue,
  AdminUserActivityRow,
  AdminUserRow,
  AdminVenueRatingActivity,
  BugReportInput,
  BugReportRecord,
  BugReportStatus,
} from "@/types/admin";

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }
  return "Unknown error";
}

function throwSupabaseError(error: unknown): never {
  throw new Error(toErrorMessage(error));
}

export async function getAdminDashboardTotals(): Promise<AdminDashboardTotals> {
  const { data, error } = await supabase.rpc("get_admin_dashboard_totals");
  if (error) {
    throwSupabaseError(error);
  }

  const row = (data?.[0] ?? null) as AdminDashboardTotals | null;
  if (!row) {
    return {
      total_places: 0,
      rated_venues: 0,
      active_ratings: 0,
      revoked_ratings: 0,
      notes_count: 0,
      users_total: 0,
      users_frozen: 0,
      bug_reports_open: 0,
      bug_reports_total: 0,
    };
  }
  return row;
}

export async function getAdminRatedVenues(limit = 100, offset = 0): Promise<AdminRatedVenue[]> {
  const { data, error } = await supabase.rpc("get_admin_rated_venues", {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) {
    throwSupabaseError(error);
  }
  return (data ?? []) as AdminRatedVenue[];
}

export async function getAdminPlaceActivity(placeId: string, limit = 300): Promise<AdminVenueRatingActivity[]> {
  const { data, error } = await supabase.rpc("get_admin_place_activity", {
    p_place_id: placeId,
    p_limit: limit,
  });
  if (error) {
    throwSupabaseError(error);
  }
  return (data ?? []) as AdminVenueRatingActivity[];
}

export async function getAdminFlaggedNotes(limit = 200, offset = 0, query = ""): Promise<AdminFlaggedNoteRow[]> {
  const { data, error } = await supabase.rpc("get_admin_flagged_notes", {
    p_limit: limit,
    p_offset: offset,
    p_query: query.trim() || null,
  });
  if (error) {
    throwSupabaseError(error);
  }
  return (data ?? []) as AdminFlaggedNoteRow[];
}

export async function getAdminUsers(limit = 100, offset = 0, query = ""): Promise<AdminUserRow[]> {
  const { data, error } = await supabase.rpc("get_admin_users", {
    p_limit: limit,
    p_offset: offset,
    p_query: query.trim() || null,
  });
  if (error) {
    throwSupabaseError(error);
  }
  return (data ?? []) as AdminUserRow[];
}

export async function getAdminUserActivity(userId: string, limit = 400): Promise<AdminUserActivityRow[]> {
  const { data, error } = await supabase.rpc("get_admin_user_activity", {
    p_user_id: userId,
    p_limit: limit,
  });
  if (error) {
    throwSupabaseError(error);
  }
  return (data ?? []) as AdminUserActivityRow[];
}

export async function adminSetUserFrozen(userId: string, frozen: boolean): Promise<void> {
  const { error } = await supabase.rpc("admin_set_user_frozen", {
    p_user_id: userId,
    p_is_frozen: frozen,
  });
  if (error) {
    throwSupabaseError(error);
  }
}

export async function adminRevokeRating(ratingId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_revoke_place_rating", {
    p_rating_id: ratingId,
    p_reason: reason?.trim() ? reason.trim().slice(0, 280) : null,
  });
  if (error) {
    throwSupabaseError(error);
  }
}

export async function adminRestoreRating(ratingId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_restore_place_rating", {
    p_rating_id: ratingId,
  });
  if (error) {
    throwSupabaseError(error);
  }
}

export async function adminDeleteRating(ratingId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_place_rating", {
    p_rating_id: ratingId,
  });
  if (error) {
    throwSupabaseError(error);
  }
}

export async function adminDeleteRatingNote(ratingId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_rating_note", {
    p_rating_id: ratingId,
  });
  if (error) {
    throwSupabaseError(error);
  }
}

export async function createBugReport(reporterId: string, input: BugReportInput): Promise<void> {
  const { error } = await supabase.from("bug_reports").insert({
    reporter_id: reporterId,
    title: input.title.trim(),
    description: input.description.trim(),
    page_route: input.page_route?.trim() || null,
    screenshot_url: input.screenshot_url?.trim() || null,
  });

  if (error) {
    throwSupabaseError(error);
  }
}

export type AdminBugReportListItem = BugReportRecord;

export async function getAdminBugReports(status: BugReportStatus | "all" = "all"): Promise<AdminBugReportListItem[]> {
  let query = supabase.from("bug_reports").select("*").order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    throwSupabaseError(error);
  }

  return (data ?? []) as AdminBugReportListItem[];
}

export async function updateAdminBugReport(
  id: string,
  input: { status?: BugReportStatus; admin_note?: string },
  actorUserId?: string,
): Promise<void> {
  const patch: Partial<BugReportRecord> = {};
  if (input.status) {
    patch.status = input.status;
  }
  if (input.admin_note !== undefined) {
    patch.admin_note = input.admin_note.trim() || null;
  }
  if (input.status === "resolved" || input.status === "dismissed") {
    patch.resolved_at = new Date().toISOString();
    patch.resolved_by = actorUserId ?? null;
  } else if (input.status) {
    patch.resolved_at = null;
    patch.resolved_by = null;
  }

  const { error } = await supabase.from("bug_reports").update(patch).eq("id", id);
  if (error) {
    throwSupabaseError(error);
  }
}

export async function deleteAdminBugReport(id: string): Promise<void> {
  const { error } = await supabase.from("bug_reports").delete().eq("id", id);
  if (error) {
    throwSupabaseError(error);
  }
}

export async function hardDeleteUser(targetUserId: string): Promise<void> {
  const { data: authData, error: authError } = await supabase.auth.getSession();
  if (authError) {
    throw new Error("Could not verify your admin session. Please log in again and retry.");
  }

  const accessToken = authData.session?.access_token;
  if (!accessToken) {
    throw new Error("Your admin session expired. Please log in again.");
  }

  const { error } = await supabase.functions.invoke("admin-delete-user", {
    body: { targetUserId },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!error) {
    return;
  }

  if (error instanceof FunctionsHttpError) {
    let status = 0;
    let payloadMessage = "";
    try {
      status = error.context.status;
      const payload = await error.context.clone().json() as { error?: unknown; message?: unknown; code?: unknown };
      if (typeof payload.error === "string" && payload.error.trim()) {
        payloadMessage = payload.error.trim();
      } else if (typeof payload.message === "string" && payload.message.trim()) {
        payloadMessage = payload.message.trim();
      } else if (typeof payload.code === "string" && payload.code.trim()) {
        payloadMessage = payload.code.trim();
      }
    } catch {
      try {
        const text = await error.context.clone().text();
        if (text.trim()) {
          payloadMessage = text.trim();
        }
      } catch {
        // no-op
      }
    }

    if (status === 401) {
      throw new Error(payloadMessage || "Authorization failed. Please log in again.");
    }

    if (status === 403) {
      throw new Error(payloadMessage || "Only super-admin users can hard delete accounts.");
    }

    if (status === 404) {
      throw new Error("Delete service is not deployed (admin-delete-user). Please deploy the Edge Function first.");
    }

    if (status === 400 || status === 422) {
      throw new Error(payloadMessage || "Could not delete this user. Check freeze state and request payload.");
    }

    throw new Error(payloadMessage || `Hard delete failed with status ${status || "unknown"}.`);
  }

  if (error instanceof FunctionsRelayError) {
    throw new Error("Delete request could not reach Supabase relay. Please retry shortly.");
  }

  if (error instanceof FunctionsFetchError) {
    throw new Error(
      "Could not reach the delete service. Check function deployment, function name, CORS, and network connectivity.",
    );
  }

  throw new Error(toErrorMessage(error));
}
