import type { PlaceRatingRecord, PlaceRecord, PlaceVibeSummary, SavedPlaceRecord } from "./place";
import type { BugReportRecord } from "./admin";
import type { LegalDocumentRecord } from "@/lib/services/legal";

export interface ProfileRecord {
  id: string;
  username: string | null;
  avatar_url: string | null;
  birth_date: string | null;
  city: string | null;
  hide_score: boolean;
  show_public_notes: boolean;
  is_frozen: boolean;
  emoji: string | null;
  gradient_from: string | null;
  gradient_to: string | null;
  role: "user" | "admin" | "super_admin";
  created_at: string;
  updated_at: string;
}

export interface PlaceRatingNoteVoteRecord {
  rating_id: string;
  user_id: string;
  vote: -1 | 1;
  created_at: string;
  updated_at: string;
}

export interface PlaceRatingNoteFlagRecord {
  id: string;
  rating_id: string;
  user_id: string;
  created_at: string;
}

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRecord;
        Insert: Partial<ProfileRecord> & Pick<ProfileRecord, "id">;
        Update: Partial<ProfileRecord>;
      };
      places: {
        Row: PlaceRecord;
        Insert: Partial<Omit<PlaceRecord, "id" | "created_at" | "updated_at">> &
          Pick<PlaceRecord, "name" | "slug" | "category" | "venue_type" | "city" | "country" | "latitude" | "longitude"> & { id?: string };
        Update: Partial<PlaceRecord>;
      };
      place_ratings: {
        Row: PlaceRatingRecord;
        Insert: Partial<Omit<PlaceRatingRecord, "id" | "created_at" | "updated_at">> &
          Pick<
            PlaceRatingRecord,
            | "place_id"
            | "user_id"
            | "classic_modern"
            | "quiet_lively"
            | "cheap_premium"
            | "local_touristy"
            | "cozy_spacious"
            | "price_range"
          > & { id?: string };
        Update: Partial<PlaceRatingRecord>;
      };
      saved_places: {
        Row: SavedPlaceRecord;
        Insert: SavedPlaceRecord;
        Update: Partial<SavedPlaceRecord>;
      };
      place_rating_note_votes: {
        Row: PlaceRatingNoteVoteRecord;
        Insert: Omit<PlaceRatingNoteVoteRecord, "created_at" | "updated_at">;
        Update: Partial<Pick<PlaceRatingNoteVoteRecord, "vote">>;
      };
      place_rating_note_flags: {
        Row: PlaceRatingNoteFlagRecord;
        Insert: Partial<Pick<PlaceRatingNoteFlagRecord, "id">> & Pick<PlaceRatingNoteFlagRecord, "rating_id" | "user_id">;
        Update: never;
      };
      bug_reports: {
        Row: BugReportRecord;
        Insert: Partial<Pick<BugReportRecord, "id" | "page_route" | "screenshot_url" | "status" | "admin_note" | "resolved_at" | "resolved_by" | "updated_at" | "created_at">>
          & Pick<BugReportRecord, "reporter_id" | "title" | "description">;
        Update: Partial<Omit<BugReportRecord, "id" | "reporter_id" | "created_at">>;
      };
      legal_documents: {
        Row: LegalDocumentRecord;
        Insert: Partial<Pick<LegalDocumentRecord, "updated_at" | "updated_by">>
          & Pick<LegalDocumentRecord, "document_key" | "title" | "content">;
        Update: Partial<Omit<LegalDocumentRecord, "document_key">>;
      };
    };
    Views: {
      place_vibe_summary: {
        Row: PlaceVibeSummary;
      };
    };
  };
}
