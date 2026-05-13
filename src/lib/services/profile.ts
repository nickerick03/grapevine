import { supabase } from "@/lib/supabase/client";
import type { ProfileRecord } from "@/types/database";

export interface ProfilePreferencesInput {
  username: string;
  city: string;
  hideScore: boolean;
  showPublicNotes: boolean;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  birthDate?: string;
  profilePhoto?: string;
}

export async function setAccountFrozen(userId: string, frozen: boolean): Promise<ProfileRecord> {
  const fullResult = await supabase
    .from("profiles")
    .update({
      is_frozen: frozen,
    })
    .eq("id", userId)
    .select("*")
    .single();

  if (!fullResult.error) {
    return fullResult.data;
  }

  if (!isMissingColumnError(fullResult.error)) {
    throw fullResult.error;
  }

  throw new Error("This project is missing the account-freeze migration.");
}

export async function saveAccountFrozenMetadata(frozen: boolean): Promise<void> {
  const { error } = await supabase.auth.updateUser({
    data: {
      is_frozen: frozen,
    },
  });

  if (error) {
    throw error;
  }
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatarUrl: string | null;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  city: string;
  grapevineScore: number;
  helpfulVotes: number;
  firstRatings: number;
  reviews: number;
  notes: number;
  cities: number;
  cityList: string[];
}

export interface PublicProfileEntry {
  userId: string;
  username: string;
  avatarUrl: string | null;
  emoji: string;
  gradientFrom: string;
  gradientTo: string;
  city: string;
  grapevineScore: number | null;
  helpfulVotes: number | null;
  firstRatings: number | null;
  ratingCount: number | null;
  notesCount: number | null;
  cityCount: number | null;
  leaderboardRank: number | null;
  scoreVisible: boolean;
  notesPublic: boolean;
  notes: PublicProfileNoteEntry[];
  createdAt: string;
}

export interface GrapevineScoreBreakdown {
  baseScore: number;
  cupRewardPoints: number;
  grapevineScore: number;
  helpfulVotesReceived: number;
  firstRatingsSubmitted: number;
  uniqueCitiesCovered: number;
  reviewsSubmitted: number;
  notesSubmitted: number;
}

export interface PublicProfileNoteEntry {
  ratingId: string;
  placeId: string;
  placeName: string;
  placeCity: string;
  note: string;
  notedAt: string;
}

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "");
}

function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42703"
    || error.message?.toLowerCase().includes("does not exist")
    || false
  );
}

export async function saveProfilePreferences(
  userId: string,
  input: ProfilePreferencesInput,
): Promise<ProfileRecord> {
  const username = normalizeUsername(input.username);
  const fullPayload: {
    username: string;
    city: string;
    hide_score: boolean;
    show_public_notes: boolean;
    emoji: string;
    gradient_from: string;
    gradient_to: string;
    birth_date?: string | null;
    avatar_url?: string | null;
  } = {
    username,
    city: input.city.trim(),
    hide_score: input.hideScore,
    show_public_notes: input.showPublicNotes,
    emoji: input.emoji,
    gradient_from: input.gradientFrom,
    gradient_to: input.gradientTo,
  };
  if (input.birthDate !== undefined) {
    fullPayload.birth_date = input.birthDate.trim() || null;
  }
  if (input.profilePhoto !== undefined) {
    fullPayload.avatar_url = input.profilePhoto || null;
  }

  const fallbackPayload = {
    username,
    avatar_url: input.profilePhoto ?? null,
  };

  const fullResult = await supabase
    .from("profiles")
    .update(fullPayload)
    .eq("id", userId)
    .select("*")
    .single();

  if (!fullResult.error) {
    return fullResult.data;
  }

  if (!isMissingColumnError(fullResult.error)) {
    throw fullResult.error;
  }

  const fallbackResult = await supabase
    .from("profiles")
    .update(fallbackPayload)
    .eq("id", userId)
    .select("*")
    .single();

  if (fallbackResult.error) {
    throw fallbackResult.error;
  }

  return fallbackResult.data;
}

export async function saveProfileMetadata(input: ProfilePreferencesInput): Promise<void> {
  const metadataPatch: Record<string, unknown> = {
    username: normalizeUsername(input.username),
    city: input.city.trim(),
    hide_score: input.hideScore,
    show_public_notes: input.showPublicNotes,
    emoji: input.emoji,
    gradient_from: input.gradientFrom,
    gradient_to: input.gradientTo,
  };
  if (input.birthDate !== undefined) {
    metadataPatch.birth_date = input.birthDate.trim() || null;
  }

  const { error } = await supabase.auth.updateUser({
    data: metadataPatch,
  });

  if (error) {
    throw error;
  }
}

type RawLeaderboardRow = {
  rank: number;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  emoji: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  city: string | null;
  rating_count: number;
  city_count: number;
  notes_count: number | null;
  first_rating_count: number | null;
  helpful_votes_received: number | null;
  grapevine_score: number | string | null;
  city_list: string[] | null;
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

type RawGrapevineScoreRow = {
  user_id: string;
  reviews_submitted: number | null;
  notes_submitted: number | null;
  unique_cities_covered: number | null;
  first_ratings_submitted: number | null;
  helpful_votes_received: number | null;
  base_grapevine_score: number | string | null;
  cup_reward_points: number | string | null;
  grapevine_score: number | string | null;
};

export async function getLeaderboard(limit = 50): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase.rpc("get_leaderboard", { p_limit: limit });

  if (error) {
    // Fallback when migration is not applied yet.
    if (error.code === "42883" || error.code === "PGRST202") {
      return [];
    }
    throw error;
  }

  const rows = (data ?? []) as RawLeaderboardRow[];

  return rows.map((row) => ({
    rank: row.rank,
    userId: row.user_id,
    username: row.username ?? "grapevine_user",
    avatarUrl: row.avatar_url,
    emoji: row.emoji ?? "🦊",
    gradientFrom: row.gradient_from ?? "#F59E0B",
    gradientTo: row.gradient_to ?? "#EF4444",
    city: row.city ?? "",
    grapevineScore: toNumeric(row.grapevine_score, 0),
    helpfulVotes: row.helpful_votes_received ?? 0,
    firstRatings: row.first_rating_count ?? 0,
    reviews: row.rating_count,
    notes: row.notes_count ?? 0,
    cities: row.city_count,
    cityList: row.city_list ?? [],
  }));
}

export async function getGrapevineScoreByUserId(userId: string): Promise<GrapevineScoreBreakdown> {
  const { data, error } = await supabase
    .from("grapevine_user_score_stats")
    .select("user_id,reviews_submitted,notes_submitted,unique_cities_covered,first_ratings_submitted,helpful_votes_received,base_grapevine_score,cup_reward_points,grapevine_score")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01" || error.code === "42703" || error.code === "PGRST205") {
      return {
        baseScore: 0,
        cupRewardPoints: 0,
        grapevineScore: 0,
        helpfulVotesReceived: 0,
        firstRatingsSubmitted: 0,
        uniqueCitiesCovered: 0,
        reviewsSubmitted: 0,
        notesSubmitted: 0,
      };
    }
    throw error;
  }

  if (!data) {
    return {
      baseScore: 0,
      cupRewardPoints: 0,
      grapevineScore: 0,
      helpfulVotesReceived: 0,
      firstRatingsSubmitted: 0,
      uniqueCitiesCovered: 0,
      reviewsSubmitted: 0,
      notesSubmitted: 0,
    };
  }

  const row = data as RawGrapevineScoreRow;

  return {
    baseScore: toNumeric(row.base_grapevine_score, 0),
    cupRewardPoints: toNumeric(row.cup_reward_points, 0),
    grapevineScore: toNumeric(row.grapevine_score, 0),
    helpfulVotesReceived: row.helpful_votes_received ?? 0,
    firstRatingsSubmitted: row.first_ratings_submitted ?? 0,
    uniqueCitiesCovered: row.unique_cities_covered ?? 0,
    reviewsSubmitted: row.reviews_submitted ?? 0,
    notesSubmitted: row.notes_submitted ?? 0,
  };
}

type RawPublicProfileRow = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  emoji: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  city: string | null;
  hide_score: boolean | null;
  show_public_notes: boolean | null;
  rating_count: number | null;
  notes_count: number | null;
  city_count: number | null;
  first_rating_count: number | null;
  helpful_votes_received: number | null;
  grapevine_score: number | string | null;
  leaderboard_rank: number | null;
  created_at: string;
};

type RawPublicProfileNoteRow = {
  rating_id: string;
  place_id: string;
  place_name: string | null;
  place_city: string | null;
  note: string | null;
  noted_at: string | null;
};

export async function getPublicProfileByUsername(username: string): Promise<PublicProfileEntry | null> {
  const normalized = username.trim().replace(/^@+/, "");
  if (!normalized) {
    return null;
  }

  const { data, error } = await supabase.rpc("get_public_profile", { p_username: normalized });

  if (error) {
    if (error.code === "42883" || error.code === "PGRST202") {
      return null;
    }
    throw error;
  }

  const row = ((data ?? []) as RawPublicProfileRow[])[0];
  if (!row) {
    return null;
  }

  let notes: PublicProfileNoteEntry[] = [];
  const notesPublic = row.show_public_notes ?? true;

  if (notesPublic) {
    const notesResult = await supabase.rpc("get_public_profile_notes", { p_username: normalized, p_limit: 1000 });
    if (!notesResult.error) {
      notes = ((notesResult.data ?? []) as RawPublicProfileNoteRow[])
        .filter((entry) => Boolean(entry.note?.trim()))
        .map((entry) => ({
          ratingId: entry.rating_id,
          placeId: entry.place_id,
          placeName: entry.place_name?.trim() || "Unknown place",
          placeCity: entry.place_city?.trim() || "",
          note: entry.note?.trim() ?? "",
          notedAt: entry.noted_at ?? row.created_at,
        }));
    } else if (!(notesResult.error.code === "42883" || notesResult.error.code === "PGRST202")) {
      throw notesResult.error;
    }
  }

  const scoreVisible = !(row.hide_score ?? false);

  return {
    userId: row.user_id,
    username: row.username ?? normalized,
    avatarUrl: row.avatar_url,
    emoji: row.emoji ?? "🦊",
    gradientFrom: row.gradient_from ?? "#F59E0B",
    gradientTo: row.gradient_to ?? "#EF4444",
    city: row.city ?? "",
    grapevineScore: scoreVisible ? toNumeric(row.grapevine_score, 0) : null,
    helpfulVotes: scoreVisible ? (row.helpful_votes_received ?? 0) : null,
    firstRatings: scoreVisible ? (row.first_rating_count ?? 0) : null,
    ratingCount: scoreVisible ? (row.rating_count ?? 0) : null,
    notesCount: scoreVisible ? (row.notes_count ?? 0) : null,
    cityCount: scoreVisible ? (row.city_count ?? 0) : null,
    leaderboardRank: scoreVisible ? row.leaderboard_rank : null,
    scoreVisible,
    notesPublic,
    notes,
    createdAt: row.created_at,
  };
}
