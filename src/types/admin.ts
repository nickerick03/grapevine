export type BugReportStatus = "open" | "triaged" | "in_progress" | "resolved" | "dismissed";

export interface AdminDashboardTotals {
  total_places: number;
  rated_venues: number;
  active_ratings: number;
  revoked_ratings: number;
  notes_count: number;
  users_total: number;
  users_frozen: number;
  bug_reports_open: number;
  bug_reports_total: number;
}

export interface AdminRatedVenue {
  place_id: string;
  place_name: string;
  city: string;
  country: string;
  address: string | null;
  venue_type: string;
  rating_count: number;
  active_rating_count: number;
  note_count: number;
  last_rating_at: string | null;
}

export interface AdminVenueRatingActivity {
  rating_id: string;
  place_id: string;
  place_name: string;
  user_id: string;
  username: string;
  user_email: string | null;
  rating_status: "active" | "revoked";
  revocation_reason: string | null;
  created_at: string;
  updated_at: string;
  note: string | null;
  visit_context: string | null;
  price_range: number | null;
  classic_modern: number;
  quiet_lively: number;
  cheap_premium: number;
  local_touristy: number;
  cozy_spacious: number;
  upvotes: number;
  downvotes: number;
  flag_count: number;
}

export interface AdminFlaggedNoteRow {
  rating_id: string;
  place_id: string;
  place_name: string;
  place_city: string;
  user_id: string;
  username: string;
  user_email: string | null;
  note: string;
  rating_status: "active" | "revoked";
  flag_count: number;
  last_flagged_at: string;
  created_at: string;
  updated_at: string;
}

export interface AdminUserRow {
  user_id: string;
  email: string | null;
  username: string;
  city: string;
  role: "user" | "admin" | "super_admin";
  is_frozen: boolean;
  created_at: string;
  updated_at: string;
  last_sign_in_at: string | null;
  grapevine_score: number;
  helpful_votes_received: number;
  first_ratings_submitted: number;
  unique_cities_covered: number;
  reviews_submitted: number;
  notes_submitted: number;
}

export interface AdminUserActivityRow {
  rating_id: string;
  place_id: string;
  place_name: string;
  place_city: string;
  rating_status: "active" | "revoked";
  revocation_reason: string | null;
  created_at: string;
  updated_at: string;
  note: string | null;
  visit_context: string | null;
  price_range: number | null;
  classic_modern: number;
  quiet_lively: number;
  cheap_premium: number;
  local_touristy: number;
  cozy_spacious: number;
}

export interface BugReportRecord {
  id: string;
  reporter_id: string;
  title: string;
  description: string;
  page_route: string | null;
  screenshot_url: string | null;
  status: BugReportStatus;
  admin_note: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BugReportInput {
  title: string;
  description: string;
  page_route?: string | null;
  screenshot_url?: string | null;
}
