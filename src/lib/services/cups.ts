import { supabase } from "@/lib/supabase/client";
import { sanitizeCupSvgMarkup } from "@/lib/cup-artwork";
import type {
  AdminCupFinalizeResult,
  CupLeaderboardEntry,
  CupRecord,
  PublicProfileCupPlacement,
} from "@/types/cup";

type RawCupRow = {
  id: string;
  name: string;
  start_at?: string | null;
  end_at?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  reward_points: number;
  svg_markup: string;
  is_active: boolean;
  finalized_at: string | null;
  created_at: string;
  updated_at: string;
  seconds_left?: number | string | null;
};

type RawCupLeaderboardRow = {
  rank: number;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  emoji: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  city: string | null;
  cup_score: number | string | null;
  all_time_score: number | string | null;
  helpful_votes_received: number | null;
  first_ratings_submitted: number | null;
  reviews_submitted: number | null;
  notes_submitted: number | null;
  unique_cities_covered: number | null;
  city_list: string[] | null;
  score_reached_at: string | null;
};

type RawCupPlacementRow = {
  cup_id: string;
  cup_name: string;
  placement: 1 | 2 | 3;
  cup_score: number | string;
  reward_points_awarded: number;
  cup_svg_markup: string | null;
  badge_svg_markup: string | null;
  cup_start_at?: string | null;
  cup_end_at?: string | null;
  cup_start_date?: string | null;
  cup_end_date?: string | null;
  awarded_at: string;
};

type RawFinalizeRow = {
  cup_id: string;
  placements_saved: number;
  rewards_saved: number;
  already_finalized: boolean;
};

function toNumeric(value: number | string | null | undefined, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function mapCup(row: RawCupRow): CupRecord {
  const startAt = row.start_at ?? (row.start_date ? `${row.start_date}T00:00:00.000Z` : new Date().toISOString());
  const endAt = row.end_at ?? (row.end_date ? `${row.end_date}T23:59:59.999Z` : new Date().toISOString());

  return {
    id: row.id,
    name: row.name,
    startAt,
    endAt,
    rewardPoints: row.reward_points,
    svgMarkup: row.svg_markup,
    isActive: row.is_active,
    finalizedAt: row.finalized_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    secondsLeft: Math.max(0, Math.round(toNumeric(row.seconds_left, 0))),
  };
}

function throwSupabaseError(error: unknown): never {
  if (typeof error === "object" && error !== null) {
    const payload = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
    };

    const parts: string[] = [];
    if (typeof payload.message === "string" && payload.message.trim()) {
      parts.push(payload.message.trim());
    }
    if (typeof payload.details === "string" && payload.details.trim()) {
      parts.push(payload.details.trim());
    }
    if (typeof payload.hint === "string" && payload.hint.trim()) {
      parts.push(`Hint: ${payload.hint.trim()}`);
    }
    if (typeof payload.code === "string" && payload.code.trim()) {
      parts.push(`Code: ${payload.code.trim()}`);
    }

    if (parts.length > 0) {
      throw new Error(parts.join(" "));
    }
  }

  if (error instanceof Error) {
    throw error;
  }
  throw new Error("Unknown Supabase error.");
}

function pickSingleRow<T>(data: unknown): T | null {
  if (!data) {
    return null;
  }

  if (Array.isArray(data)) {
    return (data[0] ?? null) as T | null;
  }

  return data as T;
}

export async function getActiveCup(): Promise<CupRecord | null> {
  const { data, error } = await supabase.rpc("get_active_cup");
  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") {
      return null;
    }
    throwSupabaseError(error);
  }

  const row = ((data ?? []) as RawCupRow[])[0];
  return row ? mapCup(row) : null;
}

export async function getCupLeaderboard(limit = 50, cupId?: string): Promise<CupLeaderboardEntry[]> {
  const { data, error } = await supabase.rpc("get_cup_leaderboard", {
    p_cup_id: cupId ?? null,
    p_limit: limit,
  });

  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") {
      return [];
    }
    throwSupabaseError(error);
  }

  const rows = (data ?? []) as RawCupLeaderboardRow[];
  return rows.map((row) => ({
    rank: row.rank,
    userId: row.user_id,
    username: row.username ?? "grapevine_user",
    avatarUrl: row.avatar_url ?? null,
    emoji: row.emoji ?? "🦊",
    gradientFrom: row.gradient_from ?? "#F59E0B",
    gradientTo: row.gradient_to ?? "#EF4444",
    city: row.city ?? "",
    cupScore: toNumeric(row.cup_score, 0),
    allTimeScore: toNumeric(row.all_time_score, 0),
    helpfulVotes: row.helpful_votes_received ?? 0,
    firstRatings: row.first_ratings_submitted ?? 0,
    reviews: row.reviews_submitted ?? 0,
    notes: row.notes_submitted ?? 0,
    cities: row.unique_cities_covered ?? 0,
    cityList: row.city_list ?? [],
    scoreReachedAt: row.score_reached_at,
  }));
}

export async function getPublicProfileCupPlacements(username: string): Promise<PublicProfileCupPlacement[]> {
  const normalized = username.trim().replace(/^@+/, "");
  if (!normalized) {
    return [];
  }

  const { data, error } = await supabase.rpc("get_public_profile_cup_placements", {
    p_username: normalized,
    p_limit: 50,
  });

  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") {
      return [];
    }
    throwSupabaseError(error);
  }

  const rows = (data ?? []) as RawCupPlacementRow[];
  return rows.map((row) => ({
    cupId: row.cup_id,
    cupName: row.cup_name,
    placement: row.placement,
    cupScore: toNumeric(row.cup_score, 0),
    rewardPointsAwarded: row.reward_points_awarded,
    cupSvgMarkup: row.cup_svg_markup,
    badgeSvgMarkup: row.badge_svg_markup,
    cupStartAt: row.cup_start_at ?? (row.cup_start_date ? `${row.cup_start_date}T00:00:00.000Z` : null),
    cupEndAt: row.cup_end_at ?? (row.cup_end_date ? `${row.cup_end_date}T23:59:59.999Z` : null),
    awardedAt: row.awarded_at,
  }));
}

export interface CupInput {
  name: string;
  startAt: string;
  endAt: string;
  rewardPoints: number;
  svgMarkup: string;
  isActive: boolean;
}

export async function getAdminCups(): Promise<CupRecord[]> {
  const { data, error } = await supabase.rpc("get_admin_cups");
  if (error) {
    throwSupabaseError(error);
  }
  return ((data ?? []) as RawCupRow[]).map(mapCup);
}

export async function adminCreateCup(input: CupInput): Promise<CupRecord> {
  const { data, error } = await supabase.rpc("admin_create_cup", {
    p_name: input.name.trim(),
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_reward_points: Math.max(0, Math.round(input.rewardPoints)),
    p_svg_markup: sanitizeCupSvgMarkup(input.svgMarkup),
    p_is_active: input.isActive,
  });
  if (error) {
    throwSupabaseError(error);
  }

  const row = pickSingleRow<RawCupRow>(data);
  if (!row) {
    throw new Error("Failed to create cup.");
  }
  return mapCup(row);
}

export async function adminUpdateCup(cupId: string, input: CupInput): Promise<CupRecord> {
  const { data, error } = await supabase.rpc("admin_update_cup", {
    p_cup_id: cupId,
    p_name: input.name.trim(),
    p_start_at: input.startAt,
    p_end_at: input.endAt,
    p_reward_points: Math.max(0, Math.round(input.rewardPoints)),
    p_svg_markup: sanitizeCupSvgMarkup(input.svgMarkup),
    p_is_active: input.isActive,
  });
  if (error) {
    throwSupabaseError(error);
  }

  const row = pickSingleRow<RawCupRow>(data);
  if (!row) {
    throw new Error("Failed to update cup.");
  }
  return mapCup(row);
}

export async function adminSetCupActive(cupId: string, isActive: boolean): Promise<CupRecord> {
  const { data, error } = await supabase.rpc("admin_set_cup_active", {
    p_cup_id: cupId,
    p_is_active: isActive,
  });
  if (error) {
    throwSupabaseError(error);
  }

  const row = pickSingleRow<RawCupRow>(data);
  if (!row) {
    throw new Error("Failed to update active cup state.");
  }
  return mapCup(row);
}

export async function adminDeleteCup(cupId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_delete_cup", {
    p_cup_id: cupId,
  });
  if (error) {
    throwSupabaseError(error);
  }
}

export async function adminFinalizeCup(cupId: string): Promise<AdminCupFinalizeResult> {
  const { data, error } = await supabase.rpc("admin_finalize_cup", {
    p_cup_id: cupId,
  });

  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") {
      throw new Error(
        "Finalize RPC is missing in your Supabase project. Please run the Cup datetime/finalize migration (20260511_cup_time_and_finalize_fix.sql), then retry.",
      );
    }
    if (error.code === "42702") {
      throw new Error(
        "Cup finalization SQL is outdated in your Supabase project (ambiguous cup_id). Please run migration 20260511_cup_finalize_ambiguity_fix.sql, then retry.",
      );
    }
    throwSupabaseError(error);
  }

  const row = pickSingleRow<RawFinalizeRow>(data);
  if (!row) {
    throw new Error("Failed to finalize cup.");
  }

  return {
    cupId: row.cup_id,
    placementsSaved: row.placements_saved,
    rewardsSaved: row.rewards_saved,
    alreadyFinalized: row.already_finalized,
  };
}
