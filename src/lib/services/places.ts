import { rankSimilarPlaces } from "@/lib/similarity";
import { supabase } from "@/lib/supabase/client";
import type {
  ExternalPlaceInput,
  NoteFlagReason,
  NoteVote,
  PlaceNoteCard,
  PlaceRatingInput,
  PlaceRatingRecord,
  PlaceRecord,
  PlaceVibeSummary,
  PlaceWithSummary,
} from "@/types/place";

interface GetPlacesOptions {
  city?: string;
  category?: string;
  venueType?: "bar" | "cafe" | "restaurant";
  query?: string;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['".,]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function normalizeExternalPlaceId(sourcePlaceId: string): string {
  if (sourcePlaceId.startsWith("osm:")) {
    return sourcePlaceId.slice(4);
  }

  return sourcePlaceId;
}

function emptySummary(placeId: string): PlaceVibeSummary {
  return {
    place_id: placeId,
    rating_count: 0,
    avg_classic_modern: null,
    avg_quiet_lively: null,
    avg_cheap_premium: null,
    avg_local_touristy: null,
    avg_cozy_spacious: null,
    avg_price_range: null,
    confidence_level: "No ratings yet",
  };
}

function isMissingRpcError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42883"
    || error.code === "PGRST202"
    || false
  );
}

export async function getPlaces(options: GetPlacesOptions = {}): Promise<PlaceRecord[]> {
  const { city, category, venueType, query } = options;

  let request = supabase
    .from("places")
    .select("*")
    .eq("is_published", true)
    .order("name", { ascending: true });

  if (city) {
    request = request.eq("city", city);
  }

  if (category && category !== "all") {
    request = request.eq("category", category);
  }

  if (venueType) {
    request = request.eq("venue_type", venueType);
  }

  if (query && query.trim()) {
    const q = query.trim();
    request = request.or(`name.ilike.%${q}%,address.ilike.%${q}%,city.ilike.%${q}%,category.ilike.%${q}%,venue_type.ilike.%${q}%`);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getPlaceBySlug(slug: string): Promise<PlaceRecord | null> {
  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getPlaceById(placeId: string): Promise<PlaceRecord | null> {
  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("id", placeId)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getPlaceByExternalSource(
  sourceProvider: "osm",
  sourcePlaceId: string,
): Promise<PlaceRecord | null> {
  const normalizedSourceId = normalizeExternalPlaceId(sourcePlaceId);
  const { data, error } = await supabase
    .from("places")
    .select("*")
    .eq("source_provider", sourceProvider)
    .eq("source_place_id", normalizedSourceId)
    .eq("is_published", true)
    .maybeSingle();

  if (!error) {
    return data;
  }

  // Backward compatibility while migration is not applied yet.
  if (error.code === "42703" || error.message.toLowerCase().includes("source_provider")) {
    return null;
  }

  throw error;
}

export async function getPlaceSummary(placeId: string): Promise<PlaceVibeSummary> {
  const { data, error } = await supabase
    .from("place_vibe_summary")
    .select("*")
    .eq("place_id", placeId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? emptySummary(placeId);
}

export async function getAllPlaceSummaries(placeIds?: string[]): Promise<PlaceVibeSummary[]> {
  let request = supabase.from("place_vibe_summary").select("*");

  if (placeIds && placeIds.length > 0) {
    request = request.in("place_id", placeIds);
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getPlaceWithSummaryBySlug(slug: string): Promise<PlaceWithSummary | null> {
  const place = await getPlaceBySlug(slug);

  if (!place) {
    return null;
  }

  const summary = await getPlaceSummary(place.id);

  return {
    place,
    summary,
  };
}

export async function getRatingsForPlace(
  placeId: string,
  limit = 20,
  includeRevoked = false,
): Promise<PlaceRatingRecord[]> {
  let request = supabase
    .from("place_ratings")
    .select("*")
    .eq("place_id", placeId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!includeRevoked) {
    request = request.eq("rating_status", "active");
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getUserRatingForPlace(
  placeId: string,
  userId: string,
  includeRevoked = false,
): Promise<PlaceRatingRecord | null> {
  let request = supabase
    .from("place_ratings")
    .select("*")
    .eq("place_id", placeId)
    .eq("user_id", userId);

  if (!includeRevoked) {
    request = request.eq("rating_status", "active");
  }

  const { data, error } = await request.maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

export async function getRatingsByUser(
  userId: string,
  limit = 50,
  includeRevoked = false,
): Promise<PlaceRatingRecord[]> {
  let request = supabase
    .from("place_ratings")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (!includeRevoked) {
    request = request.eq("rating_status", "active");
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getRatingsByUserPaged(
  userId: string,
  page: number,
  pageSize = 20,
  includeRevoked = false,
): Promise<PlaceRatingRecord[]> {
  const safePage = Math.max(0, page);
  const safePageSize = Math.max(1, Math.min(100, pageSize));
  const from = safePage * safePageSize;
  const to = from + safePageSize - 1;

  let request = supabase
    .from("place_ratings")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (!includeRevoked) {
    request = request.eq("rating_status", "active");
  }

  const { data, error } = await request;

  if (error) {
    throw error;
  }

  return data ?? [];
}

type RawPlaceNoteFeedRow = {
  rating_id: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  emoji: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  note: string | null;
  note_original?: string | null;
  noted_at: string | null;
  note_edited_at?: string | null;
  is_edited?: boolean | null;
  upvotes: number | null;
  downvotes: number | null;
  my_vote: number | null;
  flagged_by_me: boolean | null;
};

function normalizeVote(vote: number | null | undefined): NoteVote {
  if (vote === 1) return 1;
  if (vote === -1) return -1;
  return 0;
}

function mapRawNoteRow(row: RawPlaceNoteFeedRow): PlaceNoteCard {
  const note = row.note?.trim() || "";
  const noteOriginal = row.note_original?.trim() || null;
  const noteEditedAt = row.note_edited_at ?? null;
  const isEdited = Boolean(row.is_edited ?? noteEditedAt ?? noteOriginal);

  return {
    rating_id: row.rating_id,
    user_id: row.user_id,
    username: row.username?.trim() || `user_${row.user_id.slice(0, 6)}`,
    avatar_url: row.avatar_url,
    emoji: row.emoji,
    gradient_from: row.gradient_from,
    gradient_to: row.gradient_to,
    note,
    note_original: noteOriginal,
    noted_at: row.noted_at ?? new Date().toISOString(),
    note_edited_at: noteEditedAt,
    is_edited: isEdited,
    upvotes: row.upvotes ?? 0,
    downvotes: row.downvotes ?? 0,
    my_vote: normalizeVote(row.my_vote),
    flagged_by_me: Boolean(row.flagged_by_me),
  };
}

export async function getPlaceNoteFeed(placeId: string, limit = 6): Promise<PlaceNoteCard[]> {
  const { data, error } = await supabase.rpc("get_place_note_feed", {
    p_place_id: placeId,
    p_limit: limit,
  });

  if (!error) {
    const rows = (data ?? []) as RawPlaceNoteFeedRow[];
    return rows.map(mapRawNoteRow).filter((entry) => entry.note.length > 0);
  }

  if (!isMissingRpcError(error)) {
    throw error;
  }

  // Fallback when migration is not applied yet.
  const ratings = await getRatingsForPlace(placeId, limit);
  return ratings
    .filter((rating) => Boolean(rating.note?.trim()))
    .map((rating) => ({
      rating_id: rating.id,
      user_id: rating.user_id,
      username: `user_${rating.user_id.slice(0, 6)}`,
      avatar_url: null,
      emoji: "🦊",
      gradient_from: "#F59E0B",
      gradient_to: "#EF4444",
      note: rating.note?.trim() ?? "",
      note_original: null,
      noted_at: rating.updated_at ?? rating.created_at,
      note_edited_at: null,
      is_edited: false,
      upvotes: 0,
      downvotes: 0,
      my_vote: 0,
      flagged_by_me: false,
    }));
}

function isMissingColumnError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "42703"
    || error.message?.toLowerCase().includes("note_original")
    || error.message?.toLowerCase().includes("note_edited_at")
    || false
  );
}

export async function updateOwnRatingNote(
  userId: string,
  ratingId: string,
  note: string,
): Promise<{ note: string; note_original: string | null; note_edited_at: string | null; noted_at: string }> {
  const normalizedNote = note.trim().slice(0, 160);
  if (!normalizedNote) {
    throw new Error("Note cannot be empty");
  }

  const { data, error } = await supabase
    .from("place_ratings")
    .update({
      note: normalizedNote,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ratingId)
    .eq("user_id", userId)
    .eq("rating_status", "active")
    .select("note, note_original, note_edited_at, updated_at")
    .single();

  if (!error && data) {
    return {
      note: data.note?.trim() ?? normalizedNote,
      note_original: data.note_original?.trim() || null,
      note_edited_at: data.note_edited_at ?? null,
      noted_at: data.updated_at ?? new Date().toISOString(),
    };
  }

  if (error && isMissingColumnError(error)) {
    const legacy = await supabase
      .from("place_ratings")
      .update({
        note: normalizedNote,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ratingId)
      .eq("user_id", userId)
      .eq("rating_status", "active")
      .select("note, updated_at")
      .single();

    if (legacy.error || !legacy.data) {
      throw legacy.error ?? new Error("Unable to update note");
    }

    return {
      note: legacy.data.note?.trim() ?? normalizedNote,
      note_original: null,
      note_edited_at: null,
      noted_at: legacy.data.updated_at ?? new Date().toISOString(),
    };
  }

  if (error) {
    throw error;
  }

  throw new Error("Unable to update note");
}

export async function removeOwnRatingNote(userId: string, ratingId: string): Promise<void> {
  const { error } = await supabase
    .from("place_ratings")
    .update({
      note: null,
      note_original: null,
      note_edited_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ratingId)
    .eq("user_id", userId)
    .eq("rating_status", "active");

  if (!error) {
    return;
  }

  if (isMissingColumnError(error)) {
    const legacy = await supabase
      .from("place_ratings")
      .update({
        note: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", ratingId)
      .eq("user_id", userId)
      .eq("rating_status", "active");

    if (legacy.error) {
      throw legacy.error;
    }

    return;
  }

  throw error;
}

export async function setNoteVote(userId: string, ratingId: string, vote: -1 | 1): Promise<void> {
  const { error } = await supabase
    .from("place_rating_note_votes")
    .upsert(
      {
        rating_id: ratingId,
        user_id: userId,
        vote,
      },
      { onConflict: "rating_id,user_id" },
    );

  if (error) {
    throw error;
  }
}

export async function clearNoteVote(userId: string, ratingId: string): Promise<void> {
  const { error } = await supabase
    .from("place_rating_note_votes")
    .delete()
    .eq("rating_id", ratingId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function flagNote(
  userId: string,
  ratingId: string,
  reason: NoteFlagReason,
  details?: string,
): Promise<"created"> {
  const normalizedDetails = details?.trim() ? details.trim().slice(0, 280) : null;
  const existing = await supabase
    .from("place_rating_note_flags")
    .select("id")
    .eq("rating_id", ratingId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing.error) {
    throw existing.error;
  }

  if (existing.data?.id) {
    throw new Error("You already reported this note.");
  }

  const { error } = await supabase
    .from("place_rating_note_flags")
    .insert({
      rating_id: ratingId,
      user_id: userId,
      reason,
      details: reason === "other" ? normalizedDetails : null,
    });

  if (error) {
    throw error;
  }

  return "created";
}

export async function unflagNote(userId: string, ratingId: string): Promise<void> {
  const { error } = await supabase
    .from("place_rating_note_flags")
    .delete()
    .eq("rating_id", ratingId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export async function upsertPlaceRating(input: PlaceRatingInput): Promise<PlaceRatingRecord> {
  const payload = {
    place_id: input.place_id,
    user_id: input.user_id,
    classic_modern: clampScore(input.classic_modern),
    quiet_lively: clampScore(input.quiet_lively),
    cheap_premium: clampScore(input.cheap_premium),
    local_touristy: clampScore(input.local_touristy),
    cozy_spacious: clampScore(input.cozy_spacious),
    price_range: input.price_range ?? null,
    visit_context: input.visit_context ?? null,
    note: input.note?.slice(0, 160) ?? null,
  };

  const { data, error } = await supabase
    .from("place_ratings")
    .upsert(payload, { onConflict: "place_id,user_id" })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function upsertExternalPlaceFirstRating(
  externalPlace: ExternalPlaceInput,
  rating: Omit<PlaceRatingInput, "place_id">,
): Promise<{ placeId: string; rating: PlaceRatingRecord }> {
  const normalizedSourceId = normalizeExternalPlaceId(externalPlace.source_place_id);
  const existing = await getPlaceByExternalSource(externalPlace.source_provider, normalizedSourceId);

  if (existing) {
    const savedRating = await upsertPlaceRating({
      ...rating,
      place_id: existing.id,
    });
    return { placeId: existing.id, rating: savedRating };
  }

  const rpcPayload = {
    p_source_provider: externalPlace.source_provider,
    p_source_place_id: normalizedSourceId,
    p_name: externalPlace.name,
    p_category: externalPlace.category || "bar",
    p_venue_type: externalPlace.venue_type ?? "bar",
    p_price_range: rating.price_range ?? null,
    p_address: externalPlace.address,
    p_city: externalPlace.city,
    p_country: externalPlace.country,
    p_latitude: externalPlace.latitude,
    p_longitude: externalPlace.longitude,
    p_description: externalPlace.description ?? null,
    p_image_url: externalPlace.image_url ?? null,
    p_opening_hours: externalPlace.opening_hours ?? null,
    p_phone: externalPlace.phone ?? null,
    p_email: externalPlace.email ?? null,
    p_website: externalPlace.website ?? null,
    p_classic_modern: clampScore(rating.classic_modern),
    p_quiet_lively: clampScore(rating.quiet_lively),
    p_cheap_premium: clampScore(rating.cheap_premium),
    p_local_touristy: clampScore(rating.local_touristy),
    p_cozy_spacious: clampScore(rating.cozy_spacious),
    p_visit_context: rating.visit_context ?? null,
    p_note: rating.note?.slice(0, 160) ?? null,
  };

  const { data: createdPlaceId, error: rpcError } = await supabase.rpc("upsert_external_place_first_rating", rpcPayload);

  if (!rpcError && typeof createdPlaceId === "string") {
    const savedRating = await getUserRatingForPlace(createdPlaceId, rating.user_id, true);
    if (!savedRating) {
      throw new Error("Rating saved but could not read it back.");
    }
    return { placeId: createdPlaceId, rating: savedRating };
  }

  const rpcMissing =
    rpcError?.code === "42883"
    || rpcError?.code === "PGRST202"
    || rpcError?.message.toLowerCase().includes("upsert_external_place_first_rating");

  // Compatibility with older DB migration where RPC does not have venue_type / price_range params yet.
  if (rpcMissing) {
    const legacyPayload = {
      p_source_provider: externalPlace.source_provider,
      p_source_place_id: normalizedSourceId,
      p_name: externalPlace.name,
      p_category: externalPlace.category || "bar",
      p_address: externalPlace.address,
      p_city: externalPlace.city,
      p_country: externalPlace.country,
      p_latitude: externalPlace.latitude,
      p_longitude: externalPlace.longitude,
      p_description: externalPlace.description ?? null,
      p_image_url: externalPlace.image_url ?? null,
      p_classic_modern: clampScore(rating.classic_modern),
      p_quiet_lively: clampScore(rating.quiet_lively),
      p_cheap_premium: clampScore(rating.cheap_premium),
      p_local_touristy: clampScore(rating.local_touristy),
      p_cozy_spacious: clampScore(rating.cozy_spacious),
      p_visit_context: rating.visit_context ?? null,
      p_note: rating.note?.slice(0, 160) ?? null,
    };

    const { data: legacyPlaceId, error: legacyError } = await supabase.rpc(
      "upsert_external_place_first_rating",
      legacyPayload,
    );

    if (!legacyError && typeof legacyPlaceId === "string") {
      const savedRating = await getUserRatingForPlace(legacyPlaceId, rating.user_id, true);
      if (!savedRating) {
        throw new Error("Rating saved but could not read it back.");
      }
      return { placeId: legacyPlaceId, rating: savedRating };
    }
  }

  if (!rpcMissing) {
    throw rpcError;
  }

  // Compatibility fallback in case the migration has not been run yet.
  const baseSlug = slugify(externalPlace.name) || `place-${Date.now()}`;
  const generatedSlug = `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`;
  const { data: insertedPlace, error: insertError } = await supabase
    .from("places")
    .insert({
      name: externalPlace.name,
      slug: generatedSlug,
      category: externalPlace.category || "bar",
      venue_type: externalPlace.venue_type ?? "bar",
      address: externalPlace.address,
      city: externalPlace.city,
      country: externalPlace.country,
      latitude: externalPlace.latitude,
      longitude: externalPlace.longitude,
      description: externalPlace.description ?? null,
      image_url: externalPlace.image_url ?? null,
      opening_hours: externalPlace.opening_hours ?? null,
      phone: externalPlace.phone ?? null,
      email: externalPlace.email ?? null,
      website: externalPlace.website ?? null,
      source_provider: externalPlace.source_provider,
      source_place_id: normalizedSourceId,
      is_published: true,
      created_by: rating.user_id,
    })
    .select("*")
    .single();

  if (insertError || !insertedPlace) {
    throw new Error(
      "Could not save this new place yet. Please run Supabase migrations: 20260503_external_osm_first_rating.sql, 20260504_place_venue_type_price_range.sql, and 20260504_place_contact_info.sql.",
    );
  }

  const savedRating = await upsertPlaceRating({
    ...rating,
    place_id: insertedPlace.id,
  });

  return { placeId: insertedPlace.id, rating: savedRating };
}

export async function getSavedPlaces(userId: string): Promise<PlaceRecord[]> {
  const { data, error } = await supabase
    .from("saved_places")
    .select("place:places(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .map((entry) => entry.place as unknown as PlaceRecord | null)
    .filter((place): place is PlaceRecord => Boolean(place));
}

export async function getSavedPlaceIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("saved_places")
    .select("place_id")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((entry) => entry.place_id);
}

export async function savePlace(userId: string, placeId: string): Promise<void> {
  const { error } = await supabase.from("saved_places").upsert({ user_id: userId, place_id: placeId });

  if (error) {
    throw error;
  }
}

export async function revokePlaceRating(ratingId: string, reason?: string): Promise<void> {
  const { error } = await supabase.rpc("admin_revoke_place_rating", {
    p_rating_id: ratingId,
    p_reason: reason?.trim() ? reason.trim().slice(0, 280) : null,
  });

  if (error) {
    throw error;
  }
}

export async function restorePlaceRating(ratingId: string): Promise<void> {
  const { error } = await supabase.rpc("admin_restore_place_rating", {
    p_rating_id: ratingId,
  });

  if (error) {
    throw error;
  }
}

export async function unsavePlace(userId: string, placeId: string): Promise<void> {
  const { error } = await supabase
    .from("saved_places")
    .delete()
    .eq("user_id", userId)
    .eq("place_id", placeId);

  if (error) {
    throw error;
  }
}

export async function deleteOwnRating(userId: string, ratingId: string): Promise<void> {
  const { error } = await supabase
    .from("place_ratings")
    .delete()
    .eq("id", ratingId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }
}

export async function getSimilarPlaces(placeId: string, limit = 4): Promise<PlaceWithSummary[]> {
  const { data: targetPlace, error: placeError } = await supabase
    .from("places")
    .select("*")
    .eq("id", placeId)
    .maybeSingle();

  if (placeError) {
    throw placeError;
  }

  if (!targetPlace) {
    return [];
  }

  const [allPlaces, allSummaries, targetSummary] = await Promise.all([
    getPlaces(),
    getAllPlaceSummaries(),
    getPlaceSummary(placeId),
  ]);

  const summaryMap = new Map(allSummaries.map((summary) => [summary.place_id, summary]));

  return rankSimilarPlaces(targetPlace, targetSummary, allPlaces, summaryMap, limit).map((candidate) => ({
    place: candidate.place,
    summary: candidate.summary,
  }));
}

export async function getCityOptions(): Promise<string[]> {
  const { data, error } = await supabase
    .from("places")
    .select("city")
    .eq("is_published", true)
    .order("city", { ascending: true });

  if (error) {
    throw error;
  }

  const uniqueCities = new Set<string>();

  for (const row of data ?? []) {
    if (row.city) {
      uniqueCities.add(row.city);
    }
  }

  return [...uniqueCities];
}
