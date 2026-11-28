// Shapes the forum pages use. They match shadow-api's migration 0012.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

export type Db = SupabaseClient<Database>;

export type MeetingKind = "forum" | "retreat" | "kickoff";
export type MeetingStatus = "planned" | "held";

/** meetings row, plus a summary of its meeting_docs and files. */
export type Meeting = {
  id: string;
  held_on: string; // YYYY-MM-DD, the date the access rule checks
  starts_at: string | null;
  place: string | null;
  title: string;
  kind: MeetingKind;
  status: MeetingStatus;
  updated_at: string; // for "new since your last visit"
  has_agenda: boolean;
  theme: string | null; // the agenda's Purpose line, e.g. "Explore 5 cool business ideas"
  file_count: number | null; // null: not counted on list views
  path: string; // /forum/<date>, or /forum/<id> when another meeting shares the date
};

/** A file under storage meeting-files/<meeting_id>/; url is a short-lived signed URL. */
export type MeetingFile = { name: string; path: string; url: string | null };

export type MeetingDetail = Meeting & { body_md: string | null; files: MeetingFile[] };

export type LibraryAudience = "all" | "founding";

export type LibraryDoc = { slug: string; title: string; audience: LibraryAudience; updated_at: string };
export type LibraryDocDetail = LibraryDoc & { body_md: string };

export type Season = { id: string; slug: string; name: string; starts_on: string; ends_on: string; ladder: number[] | null };

/** The signed-in member's forum standing (profiles columns). */
export type Viewer = {
  id: string;
  full_name: string;
  forum_joined_on: string | null; // null and not founding: no rows
  forum_left_on: string | null;
  is_admin: boolean;
  is_founding: boolean;
};

/** active; waiting = signed up, no first-forum date yet; left = forum_left_on reached. */
export type MemberStatus = "active" | "waiting" | "left";

export type Member = Viewer & { email: string | null; status: MemberStatus; first_forum_label: string | null };

export type Access = { joined_on: string | null; left_on: string | null; founding: boolean; admin: boolean };

export type AdminResult = { ok: true } | { ok: false; error: string };

export type NewSeason = { name: string; slug: string; starts_on: string; ends_on: string; metric: string };

export type Preview = {
  meetings: Meeting[];
  library: LibraryDoc[];
  seasons: Season[];
  upcoming: Meeting[];
  beforeJoin: number; // the leak check: must be 0
};

/** Pretty date links, falling back to the id where two meetings share a date (e.g. a retreat and a forum). */
export function withPaths<T extends Omit<Meeting, "path">>(rows: T[]): (T & { path: string })[] {
  const count = new Map<string, number>();
  for (const r of rows) count.set(r.held_on, (count.get(r.held_on) ?? 0) + 1);
  return rows.map((r) => ({ ...r, path: `/forum/${(count.get(r.held_on) ?? 0) > 1 ? r.id : r.held_on}` }));
}

export function memberStatus(m: Pick<Viewer, "forum_joined_on" | "forum_left_on" | "is_founding">, today: string): MemberStatus {
  if (m.forum_left_on && m.forum_left_on <= today) return "left";
  if (!m.forum_joined_on && !m.is_founding) return "waiting";
  return "active";
}

/** Shared by both sources: what the preview found dated before the member's first forum. */
export function countBeforeJoin(meetings: Meeting[], member: Viewer): number {
  if (member.is_founding) return 0;
  return meetings.filter((x) => member.forum_joined_on == null || x.held_on < member.forum_joined_on).length;
}
