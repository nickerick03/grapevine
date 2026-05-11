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
  reason: "incorrect" | "false" | "inappropriate" | "other";
  details: string | null;
  created_at: string;
}

export interface CupPlacementRecord {
  id: string;
  cup_id: string;
  user_id: string;
  placement: 1 | 2 | 3;
  cup_score: number;
  reward_points_awarded: number;
  created_at: string;
}

export interface ScoreTransactionRecord {
  id: string;
  user_id: string;
  cup_id: string | null;
  transaction_type: "cup_reward";
  points: number;
  idempotency_key: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CupRowRecord {
  id: string;
  name: string;
  start_at: string;
  end_at: string;
  start_date?: string | null;
  end_date?: string | null;
  reward_points: number;
  svg_markup: string;
  is_active: boolean;
  finalized_at: string | null;
  finalized_by: string | null;
  created_at: string;
  updated_at: string;
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
        Insert: Partial<Pick<PlaceRatingNoteFlagRecord, "id" | "details">> &
          Pick<PlaceRatingNoteFlagRecord, "rating_id" | "user_id" | "reason">;
        Update: Partial<Pick<PlaceRatingNoteFlagRecord, "reason" | "details">>;
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
      cups: {
        Row: CupRowRecord;
        Insert: Partial<CupRowRecord> & Pick<CupRowRecord, "name" | "start_at" | "end_at" | "reward_points" | "svg_markup">;
        Update: Partial<CupRowRecord>;
      };
      cup_placements: {
        Row: CupPlacementRecord;
        Insert: Partial<Pick<CupPlacementRecord, "id" | "created_at">>
          & Pick<CupPlacementRecord, "cup_id" | "user_id" | "placement" | "cup_score" | "reward_points_awarded">;
        Update: Partial<Omit<CupPlacementRecord, "id">>;
      };
      score_transactions: {
        Row: ScoreTransactionRecord;
        Insert: Partial<Pick<ScoreTransactionRecord, "id" | "created_at" | "metadata" | "cup_id">>
          & Pick<ScoreTransactionRecord, "user_id" | "transaction_type" | "points" | "idempotency_key">;
        Update: Partial<Omit<ScoreTransactionRecord, "id" | "created_at">>;
      };
    };
    Views: {
      place_vibe_summary: {
        Row: PlaceVibeSummary;
      };
    };
  };
}
