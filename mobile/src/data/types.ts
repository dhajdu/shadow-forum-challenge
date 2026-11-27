import type { Database, GoalStatus, WhoopConnectionStatus } from "@shared/database.types";
import type { Snapshot } from "@shared/stats";

type Views = Database["public"]["Views"];
type Tables = Database["public"]["Tables"];

export type Standing = Pick<
  Views["race_standings"]["Row"],
  "user_id" | "full_name" | "contest_avg" | "contest_days" | "contest_missed" | "all_avg" | "all_days" | "last_data_day"
>;

export type Goal = Pick<
  Tables["goals"]["Row"],
  "id" | "user_id" | "title" | "unit" | "target_value" | "current_value" | "current_progress" | "current_status" | "locked" | "target_date"
> & { coach_name: string | null };

export type GoalSummary = Pick<Tables["goals"]["Row"], "user_id" | "title" | "current_status">;

export type PersonalGoal = Pick<Tables["personal_goals"]["Row"], "id" | "title" | "unit" | "target_value" | "current_value">;

export type WhoopDay = Pick<Tables["whoop_days"]["Row"], "day" | "score" | "recovery" | "sleep" | "strain" | "resting_hr" | "hrv">;

export type Upload = Pick<Tables["uploads"]["Row"], "id" | "file_name" | "status" | "rows_ingested" | "created_at">;

export type WhoopStatus = { status: WhoopConnectionStatus | null; last_sync_at: string | null };

export type GoalUpdate = {
  currentValue: number;
  targetValue?: number | null;
  unit?: string | null;
  status: GoalStatus;
  note?: string | null;
};

export type NewGoal = { title: string; unit?: string | null; targetValue?: number | null; targetDate?: string | null };

/** Weekly Claude analysis of a rider's WHOOP journal (private to the rider). */
export type JournalAnalysis = {
  week_of: string;
  headline: string;
  insights: { title: string; detail: string; effect: "helps" | "hurts" | "mixed" }[];
  suggestion: string;
};

export type MemberStatus = "active" | "invited" | "no_date" | "left";

/** Admin view of a member (GET /api/admin/members). */
export type Member = {
  id: string;
  full_name: string;
  email: string | null;
  forum_joined_on: string | null;
  forum_left_on: string | null;
  is_founding: boolean;
  is_admin: boolean;
  status: MemberStatus;
};

export type ChatMessage = { role: "user" | "assistant"; content: string; cited?: Citation[] };
export type Citation = { id: string; held_on: string; title: string | null };

export type { Snapshot };

/** A forum chat message as the member may see it (RLS: from their first forum on). */
export type ForumMessage = {
  id: string;
  author_id: string;
  author: string | null;
  body: string; // "" once deleted
  photo_id: string | null;
  photo: string | null; // signed thumbnail URL, 1 hour
  reply_to: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};
