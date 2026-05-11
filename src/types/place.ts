export const VISIT_CONTEXTS = [
  "Weekday afternoon",
  "Weekday evening",
  "Weekend afternoon",
  "Weekend evening",
  "Late night",
] as const;

export type VisitContext = (typeof VISIT_CONTEXTS)[number];
export type VenueType = "bar" | "cafe" | "restaurant";
export type PriceRange = 1 | 2 | 3 | 4;

export type VibeFieldKey =
  | "classic_modern"
  | "quiet_lively"
  | "cheap_premium"
  | "local_touristy"
  | "cozy_spacious";

export type VibeValues = Record<VibeFieldKey, number>;

export interface PlaceRecord {
  id: string;
  name: string;
  slug: string;
  category: string;
  venue_type: VenueType;
  price_range: PriceRange | null;
  address: string | null;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  description: string | null;
  image_url: string | null;
  opening_hours: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  source_provider: string | null;
  source_place_id: string | null;
  created_by: string | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface PlaceRatingRecord {
  id: string;
  place_id: string;
  user_id: string;
  rating_status: "active" | "revoked";
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  classic_modern: number;
  quiet_lively: number;
  cheap_premium: number;
  local_touristy: number;
  cozy_spacious: number;
  price_range: PriceRange | null;
  visit_context: VisitContext | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlaceVibeSummary {
  place_id: string;
  rating_count: number;
  avg_classic_modern: number | null;
  avg_quiet_lively: number | null;
  avg_cheap_premium: number | null;
  avg_local_touristy: number | null;
  avg_cozy_spacious: number | null;
  avg_price_range: number | null;
  confidence_level: "No ratings yet" | "Low confidence" | "Medium confidence" | "High confidence";
}

export interface SavedPlaceRecord {
  user_id: string;
  place_id: string;
  created_at: string;
}

export interface PlaceWithSummary {
  place: PlaceRecord;
  summary: PlaceVibeSummary;
}

export interface PlaceRatingInput {
  place_id: string;
  user_id: string;
  classic_modern: number;
  quiet_lively: number;
  cheap_premium: number;
  local_touristy: number;
  cozy_spacious: number;
  price_range?: PriceRange | null;
  visit_context?: VisitContext | null;
  note?: string | null;
}

export type NoteVote = -1 | 0 | 1;
export type NoteFlagReason = "incorrect" | "false" | "inappropriate" | "other";

export interface PlaceNoteCard {
  rating_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  emoji: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  note: string;
  note_original: string | null;
  noted_at: string;
  note_edited_at: string | null;
  is_edited: boolean;
  upvotes: number;
  downvotes: number;
  my_vote: NoteVote;
  flagged_by_me: boolean;
}

export interface ExternalPlaceInput {
  source_provider: "osm";
  source_place_id: string;
  name: string;
  category: string;
  venue_type: VenueType;
  price_range?: PriceRange | null;
  address: string | null;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  description?: string | null;
  image_url?: string | null;
  opening_hours?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}
