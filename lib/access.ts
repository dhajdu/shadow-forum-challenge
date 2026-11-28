// The forum access rule for server jobs that hold the service-role key.
//
// Postgres enforces the rule for every member session (supabase/migrations/
// 0012_forum_access.sql: member_can_see_date / member_can_see_season). The
// service role bypasses RLS, so agents, email and push go through this file
// instead. Keep the two in step: the leak suite (supabase/tests) checks that this
// file and the database give the same answer for every persona.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { SEASON_RULE_COLUMNS, type SeasonRuleColumns } from "@/lib/goal-points";

export type Member = {
  id: string;
  full_name: string;
  email: string | null;
  forum_joined_on: string | null; // YYYY-MM-DD
  forum_left_on: string | null;
  is_founding: boolean;
  is_admin: boolean;
};

export type Season = SeasonRuleColumns & { id: string; slug: string; name: string; starts_on: string; ends_on: string };

const today = () => new Date().toISOString().slice(0, 10);

/** Signed up, has a join date (or is founding), and has not left. */
export function isActive(m: Member, on = today()): boolean {
  if (m.forum_left_on && m.forum_left_on <= on) return false;
  return m.is_founding || m.forum_joined_on != null;
}

/** Same as public.member_can_see_date(). Dates are YYYY-MM-DD strings. */
export function memberCanSeeDate(m: Member, d: string | null, on = today()): boolean {
  if (!d || !isActive(m, on)) return false;
  return m.is_founding || (m.forum_joined_on != null && d >= m.forum_joined_on);
}

/** Same as public.member_can_see_season(): the season is still running on or after the first forum. */
export function memberCanSeeSeason(m: Member, s: Pick<Season, "ends_on"> | null, on = today()): boolean {
  if (!s || !isActive(m, on)) return false;
  return m.is_founding || (m.forum_joined_on != null && m.forum_joined_on <= s.ends_on);
}

/**
 * Visibility for a group output (a report email, a group push): content is shown
 * only if every recipient can see it, which in practice means the latest-joined
 * recipient. An empty group sees nothing.
 */
export function groupScope(recipients: Member[], on = today()) {
  const canSeeDate = (d: string | null) =>
    recipients.length > 0 && recipients.every((m) => memberCanSeeDate(m, d, on));
  return {
    canSeeDate,
    canSeeSeason: (s: Pick<Season, "ends_on"> | null) =>
      !!s && recipients.length > 0 && recipients.every((m) => memberCanSeeSeason(m, s, on)),
  };
}

/** Active members who can see this season: the only people a season output goes to. */
export function seasonAudience(members: Member[], season: Season | null, on = today()): Member[] {
  return members.filter((m) => memberCanSeeSeason(m, season, on));
}

/** The season a day belongs to: the latest one that had started (public.season_of). */
export function seasonOf(seasons: Season[], d: string): Season | null {
  let best: Season | null = null;
  for (const s of seasons) if (s.starts_on <= d && (!best || s.starts_on > best.starts_on)) best = s;
  return best;
}

type Admin = SupabaseClient<Database>;

export async function loadMembers(admin: Admin): Promise<Member[]> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, full_name, email, forum_joined_on, forum_left_on, is_founding, is_admin");
  if (error) throw new Error(error.message);
  return (data ?? []) as Member[];
}

export async function loadSeasons(admin: Admin): Promise<Season[]> {
  const { data, error } = await admin.from("seasons").select(`id, slug, name, starts_on, ends_on, ${SEASON_RULE_COLUMNS}`);
  if (error) throw new Error(error.message);
  return (data ?? []) as Season[];
}

/** Members, seasons, and the season running today. */
export async function loadAccess(admin: Admin) {
  const [members, seasons] = await Promise.all([loadMembers(admin), loadSeasons(admin)]);
  return { members, seasons, current: seasonOf(seasons, today()) };
}

/**
 * For a member-facing API route: is the caller an active member? Reads their own
 * profile row with their own session.
 */
export async function isActiveCaller(supabase: Admin, userId: string): Promise<boolean> {
  // no email: members cannot read profiles.email (migration 0037)
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, forum_joined_on, forum_left_on, is_founding, is_admin")
    .eq("id", userId)
    .maybeSingle();
  return !!data && isActive({ ...data, email: null } as Member);
}
