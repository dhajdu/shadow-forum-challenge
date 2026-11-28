// App v2 data: the same tables and routes the website reads (see docs/product-plan.html, iPhone app v2).
// Rule, as everywhere in this module: nothing here filters by join date, season or audience; RLS does.
// The one exception mirrors the website exactly: an agenda's running Topics list repeats older
// forums' items, so visibleParking() drops groups raised before the member's first forum.
import { randomUUID } from "expo-crypto";
import { File } from "expo-file-system";
import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { today } from "@shared/contest";
import type { Meeting } from "@shared/forum";
import type { KittyCategory, KittyEntry } from "@shared/kitty";
import { agendaTheme, parseRecap, visibleParking, type ParkingGroup, type Recap } from "@shared/recap";
import type { JournalRow, WhoopDay as BioDay } from "@shared/biometrics";
import { parseVision, type Vision } from "@shared/vision";
import { api } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { forum, fx, isDemo, must, uid, wait } from "./core";

export type { KittyCategory, KittyEntry, ParkingGroup, Recap, Vision };

// ── People ───────────────────────────────────────────────

export type Person = { id: string; full_name: string; avatar_url: string | null };

/** Names and photos of members (profiles is readable by active members). */
export async function people(): Promise<Map<string, Person>> {
  if (isDemo) return new Map(fx().members.map((m) => [m.id, { id: m.id, full_name: m.full_name, avatar_url: null }]));
  const rows = must(await supabase.from("profiles").select("id, full_name, avatar_url"));
  return new Map((rows as Person[]).map((p) => [p.id, p]));
}

/** What the Topics filter needs about the signed-in member. */
async function viewer(): Promise<{ forum_joined_on: string | null; is_founding: boolean }> {
  if (isDemo) return fx().profile;
  const { data } = await supabase.from("profiles").select("forum_joined_on, is_founding").eq("id", await uid()).single();
  return (data as { forum_joined_on: string | null; is_founding: boolean } | null) ?? { forum_joined_on: null, is_founding: false };
}

// ── Meetings with agenda facts ───────────────────────────

export type ForumListItem = Meeting & {
  theme: string | null; // the planned theme, else the agenda's Purpose
  has_agenda: boolean;
  updated_at: string | null;
  host_id: string | null;
};

const LIST_COLS =
  "id, held_on, starts_at, place, title, kind, status, lark_node_token, updated_at, theme, host_id, meeting_docs(body_md, source_updated_at)";

type ListRow = Meeting & {
  updated_at: string | null;
  theme: string | null;
  host_id: string | null;
  meeting_docs: { body_md: string | null; source_updated_at: string | null }[] | null;
};

const bodyOf = (r: { meeting_docs?: { body_md: string | null }[] | null }) =>
  (r.meeting_docs ?? []).map((d) => d.body_md ?? "").filter((b) => b.trim()).join("\n\n");

function toItem(r: ListRow): ForumListItem {
  const body = bodyOf(r);
  const docAt = (r.meeting_docs ?? []).map((d) => d.source_updated_at ?? "").sort().pop() || null;
  const updated = [r.updated_at ?? "", docAt ?? ""].sort().pop() || null;
  const { meeting_docs: _d, ...m } = r;
  return { ...m, theme: r.theme ?? agendaTheme(body), has_agenda: body.length > 0, updated_at: updated };
}

/** Every meeting the member can see, newest first, with theme and agenda flags. */
export function forums(): Promise<ForumListItem[]> {
  return forum(
    () => supabase.from("meetings").select(LIST_COLS).order("held_on", { ascending: false }),
    () => fx().meetings.map((m) => ({ ...m, theme: null, has_agenda: m.status === "held", updated_at: null, host_id: null })),
    (d) => (d as ListRow[]).map(toItem),
  );
}

export type RunLine = { position: number; day: string | null; starts_at: string | null; minutes: number | null; kind: string; title: string; owner_id: string | null; details: string | null };
export type Presentation = { presenter_id: string; coach_id: string | null; kind: "planned" | "live" };
export type MeetingFile = { name: string; url: string };

export type ForumDetail = {
  meeting: ForumListItem & { address: string | null; after_activity: string | null; ends_on: string | null; conversation_starters: string[] | null };
  recap: Recap | null;
  topics: ParkingGroup[];
  runSheet: RunLine[];
  presentations: Presentation[];
  files: MeetingFile[];
};

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const DETAIL_COLS = `${LIST_COLS}, address, after_activity, ends_on, conversation_starters, created_at`;

/** One forum by date (/forum/2026-11-25) or id: recap, topics, run sheet, presenters and files. */
export async function forumDetail(key: string): Promise<ForumDetail | null> {
  const me = await viewer();
  if (isDemo) {
    const m = fx().meetings.find((x) => (isDate(key) ? x.held_on === key : x.id === key));
    if (!m) return wait(null);
    const body = fx().docs[m.id]?.body_md ?? "";
    const recap = body ? parseRecap(body, m.held_on) : null;
    return wait({
      meeting: { ...m, theme: null, has_agenda: !!body, updated_at: null, host_id: null, address: null, after_activity: null, ends_on: null, conversation_starters: null },
      recap,
      topics: recap ? visibleParking(recap.parking, me.forum_joined_on, me.is_founding) : [],
      runSheet: [],
      presentations: [],
      files: [],
    });
  }
  const r = await supabase
    .from("meetings")
    .select(DETAIL_COLS)
    .eq(isDate(key) ? "held_on" : "id", key)
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1);
  const row = (must(r) as unknown as (ListRow & ForumDetail["meeting"])[])[0];
  if (!row) return null;
  const body = bodyOf(row);
  const recap = body ? parseRecap(body, row.held_on) : null;
  const [sheet, pres, files] = await Promise.all([
    supabase.from("meeting_agenda_items").select("position, day, starts_at, minutes, kind, title, owner_id, details").eq("meeting_id", row.id).order("position"),
    supabase.from("meeting_presentations").select("presenter_id, coach_id, kind").eq("meeting_id", row.id),
    meetingFiles(row.id),
  ]);
  return {
    meeting: { ...toItem(row), address: row.address, after_activity: row.after_activity, ends_on: row.ends_on, conversation_starters: row.conversation_starters },
    recap: recap ? { ...recap, place: row.place ?? recap.place } : null,
    topics: recap ? visibleParking(recap.parking, me.forum_joined_on, me.is_founding) : [],
    runSheet: (sheet.data as RunLine[] | null) ?? [],
    presentations: (pres.data as Presentation[] | null) ?? [],
    files,
  };
}

async function meetingFiles(meetingId: string): Promise<MeetingFile[]> {
  const store = supabase.storage.from("meeting-files");
  const { data } = await store.list(meetingId, { sortBy: { column: "name", order: "asc" } });
  const names = (data ?? []).filter((f) => f.id !== null).map((f) => f.name);
  if (!names.length) return [];
  const { data: signed } = await store.createSignedUrls(names.map((n) => `${meetingId}/${n}`), 300);
  return names.map((name, i) => ({ name, url: signed?.[i]?.signedUrl ?? "" })).filter((f) => f.url);
}

/** Topics (the agenda's Parking Lot) from the newest agenda, from the member's first forum on. */
export async function topics(): Promise<{ asOf: ForumListItem | null; groups: ParkingGroup[] }> {
  const list = await forums();
  const newest = list.find((m) => m.status === "held" && m.has_agenda) ?? null;
  if (!newest) return { asOf: null, groups: [] };
  const d = await forumDetail(newest.id);
  return { asOf: newest, groups: d?.topics ?? [] };
}

// ── Home extras ──────────────────────────────────────────

export async function vision(): Promise<Vision> {
  if (isDemo) return wait({ is: null, ambition: null });
  const { data } = await supabase.from("library_docs").select("body_md").eq("slug", "home").maybeSingle();
  return parseVision((data as { body_md: string | null } | null)?.body_md ?? "");
}

/** The previous visit (shared with the website) and stamps this one. */
export async function touchLastSeen(): Promise<string | null> {
  if (isDemo) return null;
  const { data, error } = await supabase.rpc("touch_last_seen");
  return error ? null : ((data as string | null) ?? null);
}

export type Since = { label: string; path: string }[];

export async function newSince(since: string | null): Promise<Since> {
  const from = since ?? new Date(Date.now() - 30 * 86_400_000).toISOString();
  const [list, docs] = await Promise.all([
    forums(),
    isDemo ? Promise.resolve([]) : supabase.from("library_docs").select("slug, title, updated_at").gt("updated_at", from).then((r) => (r.data as { slug: string; title: string }[] | null) ?? []),
  ]);
  const out: Since = [];
  for (const m of list) {
    if (!m.updated_at || m.updated_at <= from) continue;
    out.push({ label: m.status === "planned" ? `Forum date · ${m.held_on}` : `Agenda · ${m.held_on}`, path: `/forum/${m.held_on}` });
  }
  for (const d of docs) out.push({ label: `Updated · ${d.title}`, path: `/forum/resources/${d.slug}` });
  return out.slice(0, 5);
}

// ── Resources ────────────────────────────────────────────

export type ResourceDoc = { slug: string; title: string; audience: string | null; updated_at: string | null };

const HIDDEN = new Set(["resources", "expense-sheet", "home"]); // the page itself; the Kitty; the Home vision
const shown = (d: { slug: string }) => !HIDDEN.has(d.slug);

export async function resources(): Promise<ResourceDoc[]> {
  return forum<ResourceDoc[]>(
    () => supabase.from("library_docs").select("slug, title, audience, updated_at").order("sort").order("title"),
    () => fx().library.map((d) => ({ slug: d.slug, title: d.title, audience: d.audience, updated_at: null })).filter(shown),
    (d) => (d as ResourceDoc[]).filter(shown),
  );
}

/** A signed link to a worksheet in the private forum-resources bucket. */
export async function worksheetUrl(file: string): Promise<string | null> {
  if (isDemo) return null;
  const { data } = await supabase.storage.from("forum-resources").createSignedUrl(file, 3600);
  return data?.signedUrl ?? null;
}

// ── Constitution ─────────────────────────────────────────

export type ConstitutionVersion = { id: string; version: number; body_md: string; sha256: string; change_note: string | null; published_at: string };
export type Signature = { version_id: string; user_id: string; typed_name: string; signed_at: string };
export type Constitution = { current: ConstitutionVersion | null; versions: ConstitutionVersion[]; signatures: Signature[]; mine: Signature | null };

export async function constitution(): Promise<Constitution> {
  if (isDemo) return wait({ current: null, versions: [], signatures: [], mine: null });
  const me = await uid();
  const [v, s] = await Promise.all([
    supabase.from("constitution_versions").select("id, version, body_md, sha256, change_note, published_at").order("version", { ascending: false }),
    supabase.from("constitution_signatures").select("version_id, user_id, typed_name, signed_at").order("signed_at"),
  ]);
  const versions = (must(v) as ConstitutionVersion[]) ?? [];
  const signatures = (must(s) as Signature[]) ?? [];
  const current = versions[0] ?? null;
  return { current, versions, signatures, mine: current ? (signatures.find((x) => x.version_id === current.id && x.user_id === me) ?? null) : null };
}

/** True when a newer Constitution waits for this member's signature (the website's gate). */
export async function mustSignConstitution(): Promise<boolean> {
  if (isDemo) return false;
  const { data: v } = await supabase.from("constitution_versions").select("id").order("version", { ascending: false }).limit(1).maybeSingle();
  if (!v) return false;
  const { data: ok } = await supabase.rpc("is_active_member");
  if (!ok) return false;
  const { count } = await supabase
    .from("constitution_signatures")
    .select("id", { count: "exact", head: true })
    .eq("version_id", (v as { id: string }).id)
    .eq("user_id", await uid());
  return (count ?? 0) === 0;
}

export const consentText = (version: number) =>
  `I have read the Constitution of The Shadow Forum (version ${version}) and I agree to it. I understand that typing my name is my signature.`;

export async function signConstitution(typedName: string, sha256: string): Promise<void> {
  await api("POST", "/api/constitution/sign", { typed_name: typedName, sha256 });
}

// ── Photos ───────────────────────────────────────────────

export type Photo = { id: string; taken_on: string; meeting_id: string | null; caption: string | null; uploaded_by: string; uploader: string | null; thumb: string | null; web: string | null };

export async function photos(limit?: number): Promise<Photo[]> {
  if (isDemo) return wait([]);
  let q = supabase
    .from("gallery_photos")
    .select("id, taken_on, meeting_id, caption, uploaded_by, web_path, thumb_path, profiles:uploaded_by(full_name)")
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const rows = must(await q) as unknown as (Omit<Photo, "uploader" | "thumb" | "web"> & { web_path: string; thumb_path: string; profiles: { full_name: string } | null })[];
  if (!rows.length) return [];
  const { data: signed } = await supabase.storage.from("gallery").createSignedUrls(rows.flatMap((r) => [r.thumb_path, r.web_path]), 3600);
  const url = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    taken_on: r.taken_on,
    meeting_id: r.meeting_id,
    caption: r.caption,
    uploaded_by: r.uploaded_by,
    uploader: r.profiles?.full_name ?? null,
    thumb: url.get(r.thumb_path) ?? null,
    web: url.get(r.web_path) ?? null,
  }));
}

export type PickedPhoto = { uri: string; width: number; height: number; mimeType?: string | null; fileSize?: number | null };
const MAX_BYTES = 15 * 1024 * 1024;

/** Uploads one photo like the website: insert the row, then original + web (2048) + thumb (640) WebP. */
export async function uploadPhoto(p: PickedPhoto, at: { meetingId: string | null; takenOn: string }): Promise<void> {
  if (isDemo) return wait(undefined);
  const id = randomUUID();
  const long = Math.max(p.width, p.height);
  const fit = (max: number) => (long <= max ? [] : [{ resize: p.width >= p.height ? { width: max } : { height: max } }]);
  const [web, thumb, orig] = await Promise.all([
    manipulateAsync(p.uri, fit(2048), { compress: 0.82, format: SaveFormat.WEBP }),
    manipulateAsync(p.uri, fit(640), { compress: 0.82, format: SaveFormat.WEBP }),
    manipulateAsync(p.uri, fit(4096), { compress: 0.9, format: SaveFormat.JPEG }), // HEIC → JPEG, under 15 MB
  ]);
  const bytes = (uri: string) => new File(uri).bytes();
  const [ob, wb, tb] = await Promise.all([bytes(orig.uri), bytes(web.uri), bytes(thumb.uri)]);
  if (ob.byteLength > MAX_BYTES) throw new Error("That photo is over 15 MB.");
  const paths = { original_path: `${id}/original.jpg`, web_path: `${id}/web.webp`, thumb_path: `${id}/thumb.webp` };
  must(
    await supabase.from("gallery_photos").insert({
      id,
      taken_on: at.takenOn,
      meeting_id: at.meetingId,
      width: orig.width,
      height: orig.height,
      bytes: ob.byteLength,
      ...paths,
    }),
  );
  const store = supabase.storage.from("gallery");
  const up = await Promise.all([
    store.upload(paths.original_path, ob, { contentType: "image/jpeg" }),
    store.upload(paths.web_path, wb, { contentType: "image/webp" }),
    store.upload(paths.thumb_path, tb, { contentType: "image/webp" }),
  ]);
  const failed = up.find((u) => u.error);
  if (failed) {
    await store.remove(Object.values(paths));
    await supabase.from("gallery_photos").delete().eq("id", id);
    throw new Error(failed.error?.message ?? "Upload failed.");
  }
}

// ── Kitty ────────────────────────────────────────────────

export type KittyState = {
  balance: number;
  treasurer: string | null;
  dues: number;
  entries: (KittyEntry & { running: number })[];
  broughtForward: number;
  duesFor: { meeting: ForumListItem; members: { id: string; name: string; paid: boolean }[] } | null;
};

const KITTY_COLS = "id, entry_on, direction, amount_vnd, category, member_id, meeting_id, note, created_by, created_at, voided_at, voided_by";

export async function kitty(): Promise<KittyState> {
  if (isDemo) return wait({ balance: 0, treasurer: null, dues: 2_500_000, entries: [], broughtForward: 0, duesFor: null });
  const [bal, settings, rows, ppl, list, mem] = await Promise.all([
    supabase.rpc("kitty_balance"),
    supabase.from("kitty_settings").select("treasurer_id, dues_vnd").eq("id", true).maybeSingle(),
    supabase.from("kitty_entries").select(KITTY_COLS).order("entry_on", { ascending: false }).order("created_at", { ascending: false }).limit(500),
    people(),
    forums(),
    supabase.from("profiles").select("id, full_name, forum_joined_on, forum_left_on, is_founding"),
  ]);
  const entries = (must(rows) as KittyEntry[]) ?? [];
  const live = entries.filter((e) => !e.voided_at);
  const net = live.reduce((t, e) => t + (e.direction === "in" ? e.amount_vnd : -e.amount_vnd), 0);
  const balance = Number(bal.data ?? net);
  const broughtForward = balance - net;
  let run = broughtForward;
  const withRun = [...entries].reverse().map((e) => {
    if (!e.voided_at) run += e.direction === "in" ? e.amount_vnd : -e.amount_vnd;
    return { ...e, running: run };
  }).reverse();
  const s = settings.data as { treasurer_id: string | null; dues_vnd: number } | null;
  const t = today();
  const last = list.find((m) => m.held_on <= t && m.status === "held") ?? null;
  let duesFor: KittyState["duesFor"] = null;
  if (last) {
    const paid = new Set(live.filter((e) => e.category === "dues" && e.meeting_id === last.id && e.member_id).map((e) => e.member_id));
    const expected = ((mem.data as { id: string; full_name: string; forum_joined_on: string | null; forum_left_on: string | null; is_founding: boolean }[] | null) ?? []).filter(
      (p) => (p.is_founding || (p.forum_joined_on != null && p.forum_joined_on <= last.held_on)) && !(p.forum_left_on != null && p.forum_left_on <= last.held_on),
    );
    duesFor = { meeting: last, members: expected.map((p) => ({ id: p.id, name: p.full_name, paid: paid.has(p.id) })) };
  }
  return {
    balance,
    treasurer: s?.treasurer_id ? (ppl.get(s.treasurer_id)?.full_name ?? null) : null,
    dues: Number(s?.dues_vnd ?? 2_500_000),
    entries: withRun,
    broughtForward,
    duesFor,
  };
}

export type NewKittyLine = { direction: "in" | "out"; amount_vnd: number; category: KittyCategory; member_id: string | null; meeting_id: string | null; entry_on: string; note: string | null };

export async function addKittyLine(l: NewKittyLine): Promise<void> {
  if (isDemo) return wait(undefined);
  must(await supabase.from("kitty_entries").insert(l));
}

/** Voided lines stay, struck through; nothing is deleted. */
export async function voidKittyLine(id: string): Promise<void> {
  if (isDemo) return wait(undefined);
  must(await supabase.from("kitty_entries").update({ voided_at: new Date().toISOString() }).eq("id", id));
}

// ── Ask AI conversations ─────────────────────────────────

export type Conversation = { id: string; title: string; updated_at: string };
export type AskMessage = { id: string; role: "user" | "assistant"; content: string; cited_meeting_ids: string[] | null; created_at: string };

export async function conversations(): Promise<Conversation[]> {
  if (isDemo) return wait([]);
  return (await api<{ conversations: Conversation[] }>("GET", "/api/ask?conversations=1")).conversations;
}

export async function conversation(id: string): Promise<AskMessage[]> {
  if (isDemo) return wait([]);
  return (await api<{ messages: AskMessage[] }>("GET", `/api/ask?conversation=${encodeURIComponent(id)}`)).messages;
}

export async function deleteConversation(id: string): Promise<void> {
  if (isDemo) return wait(undefined);
  await api("DELETE", `/api/ask?conversation=${encodeURIComponent(id)}`);
}

// ── Biometrics ───────────────────────────────────────────

export async function bioDays(): Promise<BioDay[]> {
  if (isDemo) return wait((fx().days[fx().profile.id] ?? []).map((d) => ({ ...d, missed: false })) as unknown as BioDay[]);
  const me = await uid();
  return must(await supabase.from("whoop_days").select("day, score, recovery, sleep, strain, resting_hr, hrv, missed").eq("user_id", me).order("day")) as unknown as BioDay[];
}

export async function journal(days = 90): Promise<JournalRow[]> {
  if (isDemo) return wait([]);
  const me = await uid();
  const from = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const out: JournalRow[] = [];
  for (let page = 0; page < 10; page++) {
    const r = await supabase
      .from("whoop_journal")
      .select("day, question, answered_yes")
      .eq("user_id", me)
      .gte("day", from)
      .order("day")
      .order("question")
      .range(page * 1000, page * 1000 + 999);
    const rows = (must(r) as JournalRow[]) ?? [];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function disconnectWhoop(): Promise<void> {
  if (isDemo) return wait(undefined);
  await api("POST", "/api/whoop/disconnect", {});
}

// ── Account ──────────────────────────────────────────────

export async function changePassword(password: string): Promise<void> {
  if (isDemo) return wait(undefined);
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw new Error(error.message);
}

export async function myEmail(): Promise<string | null> {
  if (isDemo) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.email ?? null;
}
