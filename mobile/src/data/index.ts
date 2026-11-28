// The one data module. Screens call these functions; nothing else touches Supabase or the API.
//
// Sources:
//  - Demo persona (EXPO_PUBLIC_DEMO_PERSONA): everything from fixtures, nothing leaves the device.
//  - Live: Supabase with the member's session, so row-level security decides what comes back,
//    and the website API with the member's bearer token.
//  - Forum tables (meetings, meeting_docs, library_docs, seasons, profile forum columns) arrive with
//    shadow-api's migrations 0012–0014. Until they exist in the database, a "table/column does not
//    exist" error falls back to the founding sample and the screens say "Sample forum data".
//    Any other error (permission, network) is shown, never papered over with sample data.
//
// Rule: no function here filters by join date, season or audience. The database does that.
import type { SupabaseClient } from "@supabase/supabase-js";
import { File } from "expo-file-system";
import type { ForumProfile, LibraryDoc, Meeting, MeetingDoc, Season } from "@shared/forum";
import { today } from "@shared/contest";
import { api, ApiError } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { goalSummaries as fixtureGoalSummaries } from "./fixtures";
import type {
  Goal,
  GoalSummary,
  GoalUpdate,
  JournalAnalysis,
  ForumMessage,
  Member,
  NewGoal,
  PersonalGoal,
  Snapshot,
  Standing,
  Upload,
  WhoopDay,
  WhoopStatus,
} from "./types";

export * from "./types";

import { fx, forum, isDemo, markSample, must, sampleState, SCHEMA_MISSING, uid, wait } from "./core";

export { isDemo, sampleState, uid } from "./core";
export * from "./v2";

// ── Forum ────────────────────────────────────────────────

export async function myProfile(): Promise<ForumProfile> {
  if (isDemo) return wait(fx().profile);
  const id = await uid();
  const r = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, forum_joined_on, forum_left_on, is_admin, is_founding")
    .eq("id", id)
    .single();
  if (r.error?.code && SCHEMA_MISSING.has(r.error.code)) {
    // Before 0012: real name, sample forum columns.
    markSample();
    const row = must(await supabase.from("profiles").select("id, full_name, avatar_url").eq("id", id).single());
    return { ...fx().profile, ...row };
  }
  return must(r);
}

const MEETING_COLS = "id, held_on, starts_at, place, title, kind, status, lark_node_token";

/** Meetings, newest first, past and planned. */
export function meetings(): Promise<Meeting[]> {
  return forum(() => supabase.from("meetings").select(MEETING_COLS).order("held_on", { ascending: false }), () => fx().meetings);
}

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** One meeting by date (web path /forum/2026-11-25) or by id (push data.path). */
export function meeting(key: string): Promise<{ meeting: Meeting; doc: MeetingDoc | null } | null> {
  return forum(
    () =>
      supabase
        .from("meetings")
        .select(MEETING_COLS)
        .eq(isDate(key) ? "held_on" : "id", key)
        .limit(1)
        .then(async (r) => {
          const mt = (r.data as Meeting[] | null)?.[0];
          if (r.error || !mt) return { data: null, error: r.error };
          const d = await supabase
            .from("meeting_docs")
            .select("id, meeting_id, title, body_md, source_updated_at")
            .eq("meeting_id", mt.id)
            .limit(1);
          return { data: { meeting: mt, doc: (d.data as MeetingDoc[] | null)?.[0] ?? null }, error: d.error };
        }),
    () => {
      const mt = fx().meetings.find((x) => (isDate(key) ? x.held_on === key : x.id === key));
      return mt ? { meeting: mt, doc: fx().docs[mt.id] ?? null } : null;
    },
    (d) => (d as { meeting: Meeting; doc: MeetingDoc | null } | null) ?? null,
  );
}

/** Agenda search over what the member can already see (titles, places, dates, sample agenda text). */
export async function searchMeetings(q: string): Promise<Meeting[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const list = await meetings();
  const docs = sampleState.get() ? fx().docs : {};
  return list.filter((m) => [m.title, m.place, m.held_on, docs[m.id]?.body_md].some((s) => s?.toLowerCase().includes(needle)));
}

const LIB_COLS = "id, slug, title, body_md, file_path, audience, sort";

export function library(): Promise<LibraryDoc[]> {
  return forum(() => supabase.from("library_docs").select(LIB_COLS).order("sort"), () => fx().library);
}

export function libraryDoc(slug: string): Promise<LibraryDoc | null> {
  return forum(
    () => supabase.from("library_docs").select(LIB_COLS).eq("slug", slug).limit(1),
    () => fx().library.find((d) => d.slug === slug) ?? null,
    (d) => (d as LibraryDoc[])[0] ?? null,
  );
}

/** Seasons the member may see, newest first. Empty for members who joined after them. */
export function seasons(): Promise<Season[]> {
  return forum(
    () => supabase.from("seasons").select("id, slug, name, starts_on, ends_on, metric").order("starts_on", { ascending: false }),
    () => fx().seasons,
  );
}

// ── Admin (server-checked; the screens are also hidden for non-admins) ──

export async function members(): Promise<Member[]> {
  if (isDemo) return wait([...fx().members]);
  try {
    return (await api<{ members: Member[] }>("GET", "/api/admin/members")).members;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) throw new Error("The members API isn't deployed yet.");
    throw e;
  }
}

export async function inviteMember(b: { email: string; full_name: string; forum_joined_on: string | null }): Promise<void> {
  if (isDemo) {
    fx().members.push({ id: `u-${Date.now()}`, email: b.email, full_name: b.full_name, forum_joined_on: b.forum_joined_on, forum_left_on: null, is_admin: false, is_founding: false, status: "invited" });
    return;
  }
  await api("POST", "/api/admin/members", b);
}

export async function setMemberAccess(b: { id: string; forum_joined_on?: string | null; is_founding?: boolean; is_admin?: boolean }): Promise<void> {
  if (isDemo) {
    const m = fx().members.find((x) => x.id === b.id);
    if (m) Object.assign(m, b);
    return;
  }
  await api("PATCH", "/api/admin/members", b);
}

/** The member leaves today: from now on they see nothing. */
export async function removeMember(id: string): Promise<void> {
  if (isDemo) {
    const m = fx().members.find((x) => x.id === id);
    if (m) Object.assign(m, { forum_left_on: today(), status: "left" });
    return;
  }
  await api("DELETE", "/api/admin/members", { id });
}

// ── Contest ──────────────────────────────────────────────

export async function standings(): Promise<Standing[]> {
  if (isDemo) return wait(fx().standings);
  return must(
    await supabase
      .from("race_standings")
      .select("user_id, full_name, contest_avg, contest_days, contest_missed, all_avg, all_days, last_data_day"),
  );
}

export async function goalSummaries(): Promise<GoalSummary[]> {
  if (isDemo) return wait(fixtureGoalSummaries(fx()));
  return must(await supabase.from("goals").select("user_id, title, current_status"));
}

export async function goalOf(userId: string): Promise<Goal | null> {
  if (isDemo) return wait(fx().goals[userId] ?? null);
  const rows = must(
    await supabase
      .from("goals")
      .select("id, user_id, title, unit, target_value, current_value, current_progress, current_status, locked, target_date, coach_id")
      .eq("user_id", userId)
      .limit(1),
  );
  const g = rows[0];
  if (!g) return null;
  let coach_name: string | null = null;
  if (g.coach_id) {
    const c = await supabase.from("profiles").select("full_name").eq("id", g.coach_id).limit(1);
    coach_name = c.data?.[0]?.full_name ?? null;
  }
  const { coach_id: _coach, ...rest } = g;
  return { ...rest, coach_name };
}

export async function myGoal(): Promise<Goal | null> {
  return goalOf(await uid());
}

/** POST /api/goal: the rider's season goal (onboarding). Progress and coach log are server-side. */
export async function createGoal(g: NewGoal): Promise<void> {
  if (isDemo) {
    const id = fx().profile.id;
    fx().goals[id] = {
      id: `g-${id}`,
      user_id: id,
      title: g.title,
      unit: g.unit ?? null,
      target_value: g.targetValue ?? null,
      current_value: 0,
      current_progress: 0,
      current_status: "on_track",
      locked: false,
      target_date: g.targetDate ?? null,
      coach_name: null,
    };
    return;
  }
  await api("POST", "/api/goal", g);
}

export async function updateGoal(u: GoalUpdate): Promise<void> {
  if (isDemo) {
    const g = fx().goals[fx().profile.id];
    if (g) {
      const target = u.targetValue ?? g.target_value;
      Object.assign(g, {
        current_value: u.currentValue,
        current_status: u.status,
        target_value: target,
        unit: u.unit ?? g.unit,
        current_progress: target ? Math.max(0, Math.min(100, Math.round((u.currentValue / target) * 100))) : g.current_progress,
      });
    }
    return wait(undefined);
  }
  await api("PATCH", "/api/goal", u);
}

// Extra credit: personal goals, owner-only CRUD under RLS, no server logic.

export async function personalGoals(): Promise<PersonalGoal[]> {
  if (isDemo) return wait([...fx().personal]);
  return must(
    await supabase
      .from("personal_goals")
      .select("id, title, unit, target_value, current_value")
      .eq("user_id", await uid())
      .order("created_at", { ascending: true }),
  );
}

export async function addPersonalGoal(title: string, unit: string | null, target: number | null): Promise<void> {
  if (isDemo) {
    fx().personal.push({ id: `p${Date.now()}`, title, unit, target_value: target, current_value: 0 });
    return;
  }
  must(await supabase.from("personal_goals").insert({ user_id: await uid(), title, unit, target_value: target, current_value: 0 }));
}

export async function updatePersonalGoal(id: string, current: number): Promise<void> {
  if (isDemo) {
    const p = fx().personal.find((x) => x.id === id);
    if (p) p.current_value = current;
    return;
  }
  must(await supabase.from("personal_goals").update({ current_value: current }).eq("id", id).eq("user_id", await uid()));
}

export async function deletePersonalGoal(id: string): Promise<void> {
  if (isDemo) {
    fx().personal = fx().personal.filter((p) => p.id !== id);
    return;
  }
  must(await supabase.from("personal_goals").delete().eq("id", id).eq("user_id", await uid()));
}

/** All of a rider's WHOOP days, oldest first. Pages past PostgREST's 1000-row cap. */
export async function daysOf(userId: string): Promise<WhoopDay[]> {
  if (isDemo) return wait(fx().days[userId] ?? []);
  const all: WhoopDay[] = [];
  const page = 1000;
  for (;;) {
    const rows = must(
      await supabase
        .from("whoop_days")
        .select("day, score, recovery, sleep, strain, resting_hr, hrv")
        .eq("user_id", userId)
        .order("day", { ascending: true })
        .range(all.length, all.length + page - 1),
    );
    all.push(...rows);
    if (rows.length < page) return all;
  }
}

/** Newest weekly snapshot strictly before `day` (race "this week"). */
export async function snapshotBefore(day = today()): Promise<Snapshot | null> {
  if (isDemo) return wait([...fx().snapshots].reverse().find((s) => s.day < day) ?? null);
  const rows = must(await supabase.from("standings_snapshots").select("day, data").lt("day", day).order("day", { ascending: false }).limit(1));
  return (rows[0] as unknown as Snapshot | undefined) ?? null;
}

/** Oldest snapshot on or after `day` (monthly report movers). */
export async function snapshotOnOrAfter(day: string): Promise<Snapshot | null> {
  if (isDemo) return wait(fx().snapshots.find((s) => s.day >= day) ?? null);
  const rows = must(await supabase.from("standings_snapshots").select("day, data").gte("day", day).order("day", { ascending: true }).limit(1));
  return (rows[0] as unknown as Snapshot | undefined) ?? null;
}

/** The weekly Claude journal analysis. The table may not be deployed yet: then there is none. */
export async function latestAnalysis(): Promise<JournalAnalysis | null> {
  if (isDemo) return wait(fx().journal);
  const r = await (supabase as unknown as SupabaseClient)
    .from("journal_analyses")
    .select("week_of, headline, insights, suggestion")
    .eq("user_id", await uid())
    .order("week_of", { ascending: false })
    .limit(1);
  if (r.error) return null;
  return (r.data?.[0] as JournalAnalysis | undefined) ?? null;
}

export async function whoopStatus(): Promise<WhoopStatus> {
  if (isDemo) return wait(fx().whoop);
  const rows = must(await supabase.from("whoop_connection_status").select("status, last_sync_at").eq("user_id", await uid()).limit(1));
  return rows[0] ?? { status: null, last_sync_at: null };
}

export async function uploads(): Promise<Upload[]> {
  if (isDemo) return wait([...fx().uploads]);
  return must(
    await supabase
      .from("uploads")
      .select("id, file_name, status, rows_ingested, created_at")
      .eq("user_id", await uid())
      .order("created_at", { ascending: false })
      .limit(20),
  );
}

/** Upload a WHOOP export to Storage, record it, then ingest it via POST /api/ingest. Same flow as ios/. */
export async function uploadWhoop(file: { uri: string; name: string }, onStage: (s: "uploading" | "processing") => void): Promise<number> {
  onStage("uploading");
  if (isDemo) {
    await wait(null);
    onStage("processing");
    await wait(null);
    fx().uploads.unshift({ id: `up${Date.now()}`, file_name: file.name, status: "parsed", rows_ingested: 0, created_at: new Date().toISOString() });
    return 0;
  }
  const userId = await uid();
  const safeName = file.name.replace(/\//g, "_");
  const path = `${userId}/${Date.now()}_${safeName}`;
  const isZip = safeName.toLowerCase().endsWith(".zip");
  const bytes = await new File(file.uri).arrayBuffer();
  must(await supabase.storage.from("whoop").upload(path, bytes, { contentType: isZip ? "application/zip" : "text/csv", upsert: false }));
  const row = must(
    await supabase.from("uploads").insert({ user_id: userId, file_path: path, file_name: safeName, status: "uploaded" }).select("id").single(),
  );
  onStage("processing");
  const res = await api<{ ingested: number; error?: string | null }>("POST", "/api/ingest", { uploadId: row.id });
  if (res.error) throw new Error(res.error);
  return res.ingested;
}

/** Members may change only their name and photo (column grants in 0012). */
export async function updateName(full_name: string): Promise<void> {
  if (isDemo) {
    fx().profile.full_name = full_name;
    return;
  }
  must(await supabase.from("profiles").update({ full_name }).eq("id", await uid()));
}

/** Photo goes to the public avatars bucket under <uid>/ (0003_avatars.sql). */
export async function updateAvatar(uri: string, mime: string): Promise<void> {
  if (isDemo) {
    fx().profile.avatar_url = uri;
    return;
  }
  const id = await uid();
  const path = `${id}/${Date.now()}.${mime.includes("png") ? "png" : "jpg"}`;
  must(await supabase.storage.from("avatars").upload(path, await new File(uri).arrayBuffer(), { contentType: mime, upsert: true }));
  const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  must(await supabase.from("profiles").update({ avatar_url: url }).eq("id", id));
}

// ── Forum chat ───────────────────────────────────────────
// One channel for the whole forum. RLS shows messages from the member's first forum on;
// clients may insert { body, photo_id?, reply_to? }, edit body, or soft-delete (irreversible).

const CHAT_COLS =
  "id, author_id, body, photo_id, reply_to, created_at, edited_at, deleted_at, " +
  "author:profiles!forum_messages_author_id_fkey(full_name), photo:gallery_photos!forum_messages_photo_id_fkey(thumb_path)";
const CHAT_LIMIT = 100; // top-level messages; their thread replies come with them

type ChatRow = Omit<ForumMessage, "author" | "photo"> & {
  author: { full_name: string } | null;
  photo: { thumb_path: string } | null;
};

/**
 * The latest top-level messages with the thread replies under them, oldest first, with signed
 * photo thumbnails. Same window as the website (app/_data/chat.ts).
 */
export async function chatMessages(): Promise<ForumMessage[]> {
  if (isDemo) return wait([...fx().forumChat]);
  const r = await supabase
    .from("forum_messages")
    .select(CHAT_COLS)
    .is("reply_to", null)
    .order("created_at", { ascending: false })
    .limit(CHAT_LIMIT);
  if (r.error?.code && SCHEMA_MISSING.has(r.error.code)) {
    markSample();
    return fx().forumChat;
  }
  const top = (must(r) as unknown as ChatRow[]).reverse();
  const replies = top.length
    ? (must(
        await supabase
          .from("forum_messages")
          .select(CHAT_COLS)
          .not("reply_to", "is", null)
          .gte("created_at", top[0].created_at)
          .order("created_at")
          .limit(1000),
      ) as unknown as ChatRow[])
    : [];
  const rows = [...top, ...replies].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const paths = rows.flatMap((m) => (m.photo?.thumb_path ? [m.photo.thumb_path] : []));
  const signed = paths.length ? (await supabase.storage.from("gallery").createSignedUrls(paths, 3600)).data : null;
  const url = new Map((signed ?? []).map((x) => [x.path, x.signedUrl]));
  return rows.map((m) => ({
    ...m,
    author: m.author?.full_name ?? null,
    photo: m.photo?.thumb_path ? (url.get(m.photo.thumb_path) ?? null) : null,
  }));
}

/** Posts as the member, then asks the server to push the others (it throttles and never sends content). */
export async function postMessage(body: string, replyTo: string | null): Promise<void> {
  if (isDemo) {
    const p = fx().profile;
    fx().forumChat.push({
      id: `c${Date.now()}`,
      author_id: p.id,
      author: p.full_name,
      body,
      photo_id: null,
      photo: null,
      reply_to: replyTo,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
    });
    return wait(undefined);
  }
  const row = must(await supabase.from("forum_messages").insert({ body, reply_to: replyTo }).select("id").single());
  api("POST", "/api/forum/notify", { message_id: row.id }).catch(() => {}); // a missed push never blocks the post
}

export async function editMessage(id: string, body: string): Promise<void> {
  if (isDemo) {
    const m = fx().forumChat.find((x) => x.id === id);
    if (m) Object.assign(m, { body, edited_at: new Date().toISOString() });
    return wait(undefined);
  }
  must(await supabase.from("forum_messages").update({ body }).eq("id", id).select("id").single());
}

/** Soft delete: the server wipes the content. Cannot be undone. */
export async function deleteMessage(id: string): Promise<void> {
  if (isDemo) {
    const m = fx().forumChat.find((x) => x.id === id);
    if (m) Object.assign(m, { body: "", photo: null, photo_id: null, deleted_at: new Date().toISOString() });
    return wait(undefined);
  }
  must(await supabase.from("forum_messages").update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id").single());
}

let chatChannels = 0;

/** New, edited and deleted messages, streamed under RLS on the member's session. Returns unsubscribe. */
export function onChatChange(cb: () => void): () => void {
  if (isDemo) return () => {};
  const ch = supabase
    .channel(`forum_messages:${++chatChannels}`) // one channel per subscriber, so removing one leaves the rest
    .on("postgres_changes", { event: "*", schema: "public", table: "forum_messages" }, cb)
    .subscribe();
  return () => void supabase.removeChannel(ch);
}

let demoReadAt: string | null = null;

export async function markChatRead(): Promise<void> {
  const now = new Date().toISOString();
  if (isDemo) {
    demoReadAt = now;
    return;
  }
  const { error } = await supabase.from("forum_read_marks").upsert({ user_id: await uid(), last_read_at: now });
  if (error && !(error.code && SCHEMA_MISSING.has(error.code))) throw new Error(error.message);
}

/** Others' live messages since the member last opened the chat. */
export async function unreadChat(): Promise<number> {
  if (isDemo) {
    const me = fx().profile.id;
    return fx().forumChat.filter((m) => m.author_id !== me && !m.deleted_at && (!demoReadAt || m.created_at > demoReadAt)).length;
  }
  const me = await uid();
  const mark = await supabase.from("forum_read_marks").select("last_read_at").eq("user_id", me).maybeSingle();
  if (mark.error) return 0; // a badge is never worth an error banner
  let q = supabase.from("forum_messages").select("id", { count: "exact", head: true }).neq("author_id", me).is("deleted_at", null);
  if (mark.data?.last_read_at) q = q.gt("created_at", mark.data.last_read_at);
  const { count, error } = await q;
  return error ? 0 : (count ?? 0);
}
