// The app's database types: the CLI-generated schema (lib/database.generated.ts,
// regenerate with `npm run types`) plus a thin override for what the generator
// cannot see:
// - CHECK-constrained text columns, typed as their allowed values
// - view columns, which Postgres reports as nullable even where they never are
// - meeting_chunks.held_on, which a trigger fills, so inserts may omit it
// - function arguments that accept null (Postgres has no way to declare it)
// Add to the override only when the generator is provably wrong; never copy tables here.
import type { Database as Generated, Json } from "@/lib/database.generated";

export type { Json };

export type GoalStatus = "on_track" | "at_risk" | "behind" | "hit";
export type UploadStatus = "uploaded" | "processing" | "parsed" | "error";
export type PenaltyKind = "placement" | "missed_goal" | "coach_share";
export type WhoopConnectionStatus = "connected" | "disconnected" | "revoked";
export type MeetingKind = "forum" | "away" | "retreat" | "kickoff" | "social";
export type MeetingStatus = "planned" | "held";
export type LibraryAudience = "all" | "founding";
export type PushPlatform = "ios" | "android";

type G = Generated["public"];
type T = G["Tables"];
type V = G["Views"];
type F = G["Functions"];
type Patch<A, B> = Omit<A, keyof B> & B;
type RowPatch<K extends keyof T, P> = Patch<T[K], { Row: Patch<T[K]["Row"], P> }>;
type ArgsPatch<K extends keyof F, P> = Patch<F[K], { Args: Patch<F[K]["Args"], P> }>;

type Tables = Patch<
  T,
  {
    goals: RowPatch<"goals", { current_status: GoalStatus }>;
    goal_progress: RowPatch<"goal_progress", { status: GoalStatus }>;
    uploads: RowPatch<"uploads", { status: UploadStatus }>;
    penalties: RowPatch<"penalties", { kind: PenaltyKind }>;
    whoop_connections: RowPatch<"whoop_connections", { status: WhoopConnectionStatus }>;
    meetings: RowPatch<"meetings", { kind: MeetingKind; status: MeetingStatus }>;
    library_docs: RowPatch<"library_docs", { audience: LibraryAudience | null }>;
    push_devices: RowPatch<"push_devices", { platform: PushPlatform }>;
    chat_messages: RowPatch<"chat_messages", { role: "user" | "assistant" }>;
    meeting_chunks: Patch<T["meeting_chunks"], { Insert: Patch<T["meeting_chunks"]["Insert"], { held_on?: string } > }>;
  }
>;

type Views = Patch<
  V,
  {
    race_standings: Patch<
      V["race_standings"],
      {
        Row: {
          user_id: string;
          full_name: string;
          contest_avg: number;
          contest_days: number;
          contest_missed: number;
          all_avg: number;
          all_days: number;
          last_day: string | null;
          last_data_day: string | null;
          season_id: string;
        };
      }
    >;
    season_standings: Patch<
      V["season_standings"],
      {
        Row: {
          user_id: string;
          full_name: string;
          contest_avg: number;
          contest_days: number;
          contest_missed: number;
          all_avg: number;
          all_days: number;
          last_day: string | null;
          last_data_day: string | null;
          season_id: string;
        };
      }
    >;
    whoop_connection_status: Patch<
      V["whoop_connection_status"],
      { Row: Patch<V["whoop_connection_status"]["Row"], { user_id: string; status: WhoopConnectionStatus; updated_at: string }> }
    >;
  }
>;

type Functions = Patch<
  F,
  {
    set_member_access: ArgsPatch<"set_member_access", { joined_on: string | null; left_on: string | null }>;
    match_meeting_chunks: ArgsPatch<"match_meeting_chunks", { only_meeting?: string | null }>;
  }
>;

export type Database = Patch<Generated, { public: Patch<G, { Tables: Tables; Views: Views; Functions: Functions }> }>;
