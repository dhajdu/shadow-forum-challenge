// Forum row shapes, derived from shadow-api's schema (shared/database.types.ts).
import type { Database } from "./database.types";

type T = Database["public"]["Tables"];

export type { LibraryAudience, MeetingKind, MeetingStatus, PushPlatform } from "./database.types";
export type Meeting = Pick<T["meetings"]["Row"], "id" | "held_on" | "starts_at" | "place" | "title" | "kind" | "status" | "lark_node_token">;
export type MeetingDoc = Pick<T["meeting_docs"]["Row"], "id" | "meeting_id" | "title" | "body_md" | "source_updated_at">;
export type LibraryDoc = Pick<T["library_docs"]["Row"], "id" | "slug" | "title" | "body_md" | "file_path" | "audience" | "sort">;
export type Season = Pick<T["seasons"]["Row"], "id" | "slug" | "name" | "starts_on" | "ends_on" | "metric">;
export type PushDevice = T["push_devices"]["Row"];
export type ForumProfile = Pick<
  T["profiles"]["Row"],
  "id" | "full_name" | "avatar_url" | "forum_joined_on" | "forum_left_on" | "is_admin" | "is_founding"
>;

/** Meetings may have no title; the web and app both fall back to the kind. */
export const meetingTitle = (m: Pick<Meeting, "title" | "kind" | "place">) =>
  m.title ?? (m.kind === "retreat" ? "Retreat" : m.kind === "kickoff" ? "Kickoff" : m.place ? `Forum ${m.place}` : "Forum");
