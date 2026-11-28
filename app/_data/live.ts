/* eslint-disable @typescript-eslint/no-unused-vars -- same signatures as fixtures.ts; RLS needs no viewer argument */
// Real forum queries against shadow-api's migration 0012. Every call uses the member's own
// Supabase session: RLS (can_see_date, can_see_season, library audience) decides what comes back.
// Nothing here filters by date or audience itself.
import {
  countBeforeJoin,
  withPaths,
  memberStatus,
  type Access,
  type AdminResult,
  type Db,
  type LibraryAudience,
  type LibraryDoc,
  type LibraryDocDetail,
  type Meeting,
  type MeetingDetail,
  type MeetingFile,
  type MeetingKind,
  type MeetingStatus,
  type Member,
  type NewSeason,
  type Preview,
  type Season,
  type Viewer,
} from "./types";
import { agendaTheme } from "./recap";
import { todayIn } from "./format";
import { getForumSettings } from "@/lib/forum-settings";

const VIEWER_COLS = "id, full_name, forum_joined_on, forum_left_on, is_admin, is_founding";
const MEETING_COLS = "id, held_on, starts_at, place, title, kind, status, updated_at, meeting_docs(id, body_md, source_updated_at)";

type MeetingRow = {
  id: string;
  held_on: string;
  starts_at: string | null;
  place: string | null;
  title: string | null;
  kind: MeetingKind;
  status: MeetingStatus;
  updated_at: string;
  meeting_docs: { id: string; body_md: string; source_updated_at: string | null }[] | null;
};

const KIND_TITLE: Record<MeetingKind, string> = { forum: "Forum", away: "Away forum", retreat: "Retreat", kickoff: "Kickoff", social: "Social" };

function toMeeting(r: MeetingRow): Omit<Meeting, "path"> {
  const docs = r.meeting_docs ?? [];
  const docTimes = docs.map((d) => d.source_updated_at).filter((x): x is string => !!x);
  return {
    id: r.id,
    held_on: r.held_on,
    starts_at: r.starts_at,
    place: r.place,
    title: r.title || KIND_TITLE[r.kind] || "Forum",
    kind: r.kind,
    status: r.status,
    updated_at: [r.updated_at, ...docTimes].sort().at(-1) ?? r.updated_at,
    has_agenda: docs.some((d) => d.body_md.trim() !== ""),
    theme: docs.map((d) => agendaTheme(d.body_md)).find(Boolean) ?? null,
    file_count: null,
  };
}

const fail = (what: string, e: { message: string } | null) => {
  if (e) throw new Error(`${what}: ${e.message}`);
};

export async function getViewer(db: Db, userId: string): Promise<Viewer> {
  const { data, error } = await db.from("profiles").select(VIEWER_COLS).eq("id", userId).maybeSingle();
  fail("profile", error);
  const v = data as Viewer | null;
  // no row (should not happen): treat as a member with no date, who sees nothing
  return v ?? { id: userId, full_name: "Member", forum_joined_on: null, forum_left_on: null, is_admin: false, is_founding: false };
}

export async function listMeetings(db: Db, _v: Viewer): Promise<Meeting[]> {
  const { data, error } = await db.from("meetings").select(MEETING_COLS).order("held_on", { ascending: false });
  fail("meetings", error);
  return withPaths(((data ?? []) as MeetingRow[]).map(toMeeting));
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function filesFor(db: Db, meetingId: string): Promise<MeetingFile[]> {
  const bucket = db.storage.from("meeting-files");
  const { data } = await bucket.list(meetingId, { sortBy: { column: "name", order: "asc" } });
  const objects = (data ?? []).filter((o) => o.id); // folders have no id
  if (objects.length === 0) return [];
  const paths = objects.map((o) => `${meetingId}/${o.name}`);
  const { data: signed } = await bucket.createSignedUrls(paths, 300);
  return objects.map((o, i) => ({ name: o.name, path: paths[i], url: signed?.[i]?.signedUrl ?? null }));
}

/** By date (YYYY-MM-DD, the web URL) or by id (push deep links use /forum/<meeting_id>). */
export async function getMeeting(db: Db, _v: Viewer, key: string): Promise<MeetingDetail | null> {
  const q = db.from("meetings").select(MEETING_COLS);
  const { data, error } = await (UUID.test(key) ? q.eq("id", key) : q.eq("held_on", key))
    .order("starts_at", { nullsFirst: false })
    .order("created_at")
    .limit(1);
  fail("meeting", error);
  const row = ((data ?? []) as MeetingRow[])[0];
  if (!row) return null;
  const files = await filesFor(db, row.id);
  const body = (row.meeting_docs ?? []).map((d) => d.body_md).filter((b) => b.trim()).join("\n\n");
  return { ...toMeeting(row), path: `/forum/${key}`, body_md: body || null, files, file_count: files.length };
}

/** Title, place and agenda text, case-insensitive. (A full-text RPC can replace this later.) */
export async function searchMeetings(db: Db, _v: Viewer, q: string): Promise<Meeting[]> {
  const needle = q.trim().replace(/[%_,()\\]/g, " ").trim();
  if (!needle) return [];
  const like = `%${needle}%`;
  const [byMeeting, byDoc] = await Promise.all([
    db.from("meetings").select(MEETING_COLS).or(`title.ilike.${like},place.ilike.${like}`),
    db.from("meeting_docs").select("meeting_id").ilike("body_md", like),
  ]);
  fail("search", byMeeting.error ?? byDoc.error);
  const ids = new Set(((byDoc.data ?? []) as { meeting_id: string }[]).map((d) => d.meeting_id));
  const found = new Map(((byMeeting.data ?? []) as MeetingRow[]).map((r) => [r.id, r]));
  const missing = [...ids].filter((id) => !found.has(id));
  if (missing.length) {
    const { data, error } = await db.from("meetings").select(MEETING_COLS).in("id", missing);
    fail("search", error);
    for (const r of (data ?? []) as MeetingRow[]) found.set(r.id, r);
  }
  return withPaths([...found.values()].map(toMeeting).sort((a, b) => b.held_on.localeCompare(a.held_on)));
}

export async function listUpcoming(db: Db, _v: Viewer, day: string): Promise<Meeting[]> {
  const { data, error } = await db
    .from("meetings")
    .select(MEETING_COLS)
    .eq("status", "planned")
    .gte("held_on", day)
    .order("held_on", { ascending: true });
  fail("upcoming", error);
  return withPaths(((data ?? []) as MeetingRow[]).map(toMeeting));
}

type LibRow = { slug: string; title: string; audience: LibraryAudience; updated_at: string; body_md: string | null };

export async function listLibrary(db: Db, _v: Viewer): Promise<LibraryDoc[]> {
  const { data, error } = await db.from("library_docs").select("slug, title, audience, updated_at").order("sort").order("title");
  fail("library", error);
  return (data ?? []) as LibraryDoc[];
}

export async function getLibraryDoc(db: Db, _v: Viewer, slug: string): Promise<LibraryDocDetail | null> {
  const { data, error } = await db.from("library_docs").select("slug, title, audience, updated_at, body_md").eq("slug", slug).maybeSingle();
  fail("library doc", error);
  const r = data as LibRow | null;
  return r ? { ...r, body_md: r.body_md ?? "" } : null;
}

export async function listSeasons(db: Db, _v: Viewer): Promise<Season[]> {
  const { data, error } = await db.from("seasons").select("id, slug, name, starts_on, ends_on, ladder").order("starts_on", { ascending: false });
  fail("seasons", error);
  return (data ?? []) as Season[];
}

/** The moderator is the forum's admin (no separate flag yet). */
export async function getModerator(db: Db): Promise<string> {
  const { data } = await db.from("profiles").select("full_name").eq("is_admin", true).order("forum_joined_on").limit(1);
  return ((data ?? []) as { full_name: string }[])[0]?.full_name ?? "The moderator";
}

export async function listMembers(db: Db, v: Viewer): Promise<Member[]> {
  if (!v.is_admin) return [];
  const { data, error } = await db.from("profiles").select(`${VIEWER_COLS}, email`).order("forum_joined_on", { ascending: true, nullsFirst: false });
  fail("members", error);
  const day = todayIn((await getForumSettings()).timeZone);
  return ((data ?? []) as (Viewer & { email: string | null })[]).map((r) => ({
    ...r,
    status: memberStatus(r, day),
    first_forum_label: null,
  }));
}

export async function getMember(db: Db, v: Viewer, id: string): Promise<Member | null> {
  return (await listMembers(db, v)).find((x) => x.id === id) ?? null;
}

/** rpc('set_member_access'): admin-only in the database (42501 otherwise). */
export async function setMemberAccess(db: Db, _v: Viewer, id: string, a: Access): Promise<AdminResult> {
  const { error } = await db.rpc("set_member_access", {
    member: id,
    joined_on: a.joined_on,
    left_on: a.left_on,
    founding: a.founding,
    admin: a.admin,
  });
  if (!error) return { ok: true };
  return { ok: false, error: error.code === "42501" ? "Only admins can change access." : error.message };
}

export async function listAllSeasons(db: Db, v: Viewer): Promise<Season[]> {
  return v.is_admin ? listSeasons(db, v) : [];
}

/** Insert under the "seasons admin insert" policy. The ladder stays as in lib/contest until it is editable. */
export async function createSeason(db: Db, _v: Viewer, s: NewSeason): Promise<AdminResult> {
  const { error } = await db.from("seasons").insert({ ...s });
  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Preview as member: rpc('admin_preview', { member }) runs the real rule with that member's stored
 * dates (admin-only in the database). The admin, a founding member, sees every row, so the result
 * is the admin's rows narrowed to what the rule returned.
 */
export async function previewAs(db: Db, admin: Viewer, who: Member, day: string): Promise<Preview | null> {
  if (!admin.is_admin) return null;
  const { data, error } = await db.rpc("admin_preview", { member: who.id });
  if (error || !data) return null;
  const r = data as { active: boolean; meetings: { id: string }[] | null; library: string[] | null; seasons: string[] | null };
  const mIds = new Set((r.meetings ?? []).map((m) => m.id));
  const lSlugs = new Set(r.library ?? []);
  const sIds = new Set(r.seasons ?? []);
  const [meetings, library, seasons] = await Promise.all([listMeetings(db, admin), listLibrary(db, admin), listSeasons(db, admin)]);
  const visible = meetings.filter((m) => mIds.has(m.id));
  return {
    meetings: visible,
    library: library.filter((d) => lSlugs.has(d.slug)),
    seasons: seasons.filter((x) => sIds.has(x.id)),
    upcoming: visible.filter((m) => m.status === "planned" && m.held_on >= day).reverse(),
    beforeJoin: countBeforeJoin(visible, who),
  };
}

/** rpc('touch_last_seen'): returns the previous visit and stamps now. */
export async function touchLastSeen(db: Db): Promise<string | null> {
  const { data, error } = await db.rpc("touch_last_seen");
  return error ? null : ((data as string | null) ?? null);
}
