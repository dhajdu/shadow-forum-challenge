/* eslint-disable @typescript-eslint/no-unused-vars -- fixture stubs keep the live signatures */
// Placeholder forum data in the live shapes. No real forum content. The access rule is applied
// here in code only so every persona can be checked before the tables exist; live.ts leaves it
// to Postgres.
import {
  countBeforeJoin,
  withPaths,
  memberStatus,
  type Access,
  type AdminResult,
  type Db,
  type LibraryDoc,
  type LibraryDocDetail,
  type Meeting,
  type MeetingDetail,
  type Member,
  type NewSeason,
  type Preview,
  type Season,
  type Viewer,
} from "./types";
import { agendaTheme } from "./recap";
import { todayIn } from "./format";
import { DEFAULT_FORUM_SETTINGS } from "@/lib/forum-config";

const PLACEHOLDER_AGENDA = `## Agenda
1. Opening and confidentiality
2. Updates, 5 min each
3. Presentation
4. Parking lot

Placeholder agenda. The real text is imported.`;

type Row = Omit<MeetingDetail, "has_agenda" | "theme" | "file_count" | "path">;

const m = (held_on: string, title: string, extra: Partial<Row> = {}): Row => ({
  id: `fx-${held_on}`,
  held_on,
  starts_at: null,
  place: null,
  title,
  kind: "forum",
  status: "held",
  updated_at: `${held_on}T12:00:00+07:00`,
  body_md: PLACEHOLDER_AGENDA,
  files: [],
  ...extra,
});

const MEETINGS: Row[] = [
  m("2026-01-19", "Kickoff", { kind: "kickoff" }),
  m("2026-02-05", "Forum"),
  m("2026-03-05", "Forum"),
  m("2026-04-28", "Forum"),
  m("2026-05-25", "Forum Lisbon", { place: "Lisbon" }),
  m("2026-07-28", "Forum"),
  m("2026-08-24", "Forum"),
  m("2026-09-22", "Forum"),
  m("2026-10-08", "Mini Retreat", { kind: "retreat" }),
  m("2026-11-25", "Forum Riverside", {
    place: "Riverside",
    starts_at: "2026-11-25T18:00:00+07:00",
    files: [{ name: "Slides.pdf", path: "fx-2026-11-25/slides.pdf", url: null }],
    updated_at: "2026-11-26T09:00:00+07:00",
  }),
  m("2026-12-23", "Forum", {
    starts_at: "2026-12-23T18:00:00+07:00",
    status: "planned",
    body_md: null,
    updated_at: "2026-11-27T08:00:00+07:00",
  }),
];

const LIBRARY: LibraryDocDetail[] = [
  { slug: "constitution", title: "Approved Constitution", audience: "all", updated_at: "2026-02-05T12:00:00+07:00", body_md: "Placeholder. The approved Constitution is imported." },
  { slug: "resources", title: "Resources", audience: "all", updated_at: "2026-08-24T12:00:00+07:00", body_md: "Placeholder. Forum resources are imported." },
  { slug: "expense-sheet", title: "Expense Sheet", audience: "founding", updated_at: "2026-11-25T12:00:00+07:00", body_md: "Placeholder. The Expense Sheet is imported." },
];

// Matches the Q4 2026 row (migrations 0012 and 0034).
const SEASONS: Season[] = [
  {
    id: "fx-2026-q4",
    slug: "2026-q4",
    name: "Q4 2026",
    starts_on: "2026-09-23",
    ends_on: "2026-12-22",
    ladder: [0, 2_000_000, 3_000_000, 4_000_000, 5_000_000],
    contest_name: "Race Into the Shadow",
    scoring: "whoop",
  },
];

const FOUNDED = "2026-01-19";
const member = (id: string, full_name: string, joined: string | null, extra: Partial<Member> = {}): Member => ({
  id, full_name, email: null, forum_joined_on: joined, forum_left_on: null, is_admin: false, is_founding: false,
  status: "active", first_forum_label: null, ...extra,
});
const MEMBERS: Member[] = [
  member("fx-ana", "Ana Souza", FOUNDED, { is_admin: true, is_founding: true }),
  member("fx-founding-2", "Founding member 2", FOUNDED, { is_founding: true }),
  member("fx-founding-3", "Founding member 3", FOUNDED, { is_founding: true }),
  member("fx-founding-4", "Founding member 4", FOUNDED, { is_founding: true }),
  member("fx-noah", "Noah Turner", "2026-07-28"),
  member("fx-mia", "Mia Archer", "2026-12-23"),
  member("fx-diego", "Diego Ramos", null, { status: "waiting", first_forum_label: "Jan 2027" }),
];

const today = () => todayIn(DEFAULT_FORUM_SETTINGS.timeZone);
const active = (v: Viewer) => memberStatus(v, today()) === "active";
const canSeeDate = (v: Viewer, d: string) => active(v) && (v.is_founding || (v.forum_joined_on != null && d >= v.forum_joined_on));
const canSeeDoc = (v: Viewer, d: LibraryDoc) => active(v) && (d.audience === "all" || v.is_founding);
const summary = ({ body_md, files, ...rest }: Row): Omit<Meeting, "path"> => ({ ...rest, has_agenda: body_md != null, theme: agendaTheme(body_md), file_count: files.length });

/** Fixture viewer: the member's real name, founding, admin only outside production. */
export async function getViewer(db: Db, userId: string): Promise<Viewer> {
  const { data } = await db.from("profiles").select("full_name").eq("id", userId).maybeSingle();
  return {
    id: userId,
    full_name: (data as { full_name: string } | null)?.full_name || "Member",
    forum_joined_on: FOUNDED,
    forum_left_on: null,
    is_admin: process.env.NODE_ENV !== "production",
    is_founding: true,
  };
}

export async function listMeetings(_db: Db, v: Viewer): Promise<Meeting[]> {
  return withPaths(MEETINGS.filter((x) => canSeeDate(v, x.held_on)).map(summary).sort((a, b) => b.held_on.localeCompare(a.held_on)));
}

/** By date (YYYY-MM-DD, the web URL) or by id (push deep links). */
export async function getMeeting(_db: Db, v: Viewer, key: string): Promise<MeetingDetail | null> {
  const row = MEETINGS.find((x) => x.held_on === key || x.id === key);
  if (!row || !canSeeDate(v, row.held_on)) return null;
  return { ...row, path: `/forum/${key}`, has_agenda: row.body_md != null, theme: agendaTheme(row.body_md), file_count: row.files.length };
}

export async function searchMeetings(db: Db, v: Viewer, q: string): Promise<Meeting[]> {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const all = new Map((await listMeetings(db, v)).map((x) => [x.id, x]));
  const visible = new Set(all.keys());
  return MEETINGS.filter((x) => visible.has(x.id) && `${x.title} ${x.place ?? ""} ${x.body_md ?? ""}`.toLowerCase().includes(needle))
    .map(summary)
    .sort((a, b) => b.held_on.localeCompare(a.held_on))
    .map((x) => all.get(x.id)!);
}

export async function listUpcoming(db: Db, v: Viewer, day: string): Promise<Meeting[]> {
  return (await listMeetings(db, v)).filter((x) => x.status === "planned" && x.held_on >= day).reverse();
}

export async function listLibrary(_db: Db, v: Viewer): Promise<LibraryDoc[]> {
  return LIBRARY.filter((d) => canSeeDoc(v, d)).map(({ body_md, ...d }) => d);
}

export async function getLibraryDoc(_db: Db, v: Viewer, slug: string): Promise<LibraryDocDetail | null> {
  const doc = LIBRARY.find((d) => d.slug === slug);
  return doc && canSeeDoc(v, doc) ? doc : null;
}

export async function listSeasons(_db: Db, v: Viewer): Promise<Season[]> {
  return SEASONS.filter((s) => canSeeDate(v, s.starts_on)).sort((a, b) => b.starts_on.localeCompare(a.starts_on));
}

export async function getModerator(_db: Db): Promise<string> {
  return "Ana Souza";
}

export async function listMembers(_db: Db, v: Viewer): Promise<Member[]> {
  return v.is_admin ? MEMBERS : [];
}

export async function getMember(db: Db, v: Viewer, id: string): Promise<Member | null> {
  return (await listMembers(db, v)).find((x) => x.id === id) ?? null;
}

const NOT_SAVED: AdminResult = { ok: false, error: "Not saved: this preview runs on placeholder data." };

export async function setMemberAccess(_db: Db, _v: Viewer, _id: string, _a: Access): Promise<AdminResult> {
  return NOT_SAVED;
}

export async function listAllSeasons(_db: Db, v: Viewer): Promise<Season[]> {
  return v.is_admin ? SEASONS : [];
}

export async function createSeason(_db: Db, _v: Viewer, _s: NewSeason): Promise<AdminResult> {
  return NOT_SAVED;
}

export async function previewAs(db: Db, admin: Viewer, who: Member, day: string): Promise<Preview | null> {
  if (!admin.is_admin) return null;
  const [meetings, library, seasons, upcoming] = await Promise.all([
    listMeetings(db, who),
    listLibrary(db, who),
    listSeasons(db, who),
    listUpcoming(db, who, day),
  ]);
  return { meetings, library, seasons, upcoming, beforeJoin: countBeforeJoin(meetings, who) };
}

/** Fixtures keep no visit history; Home falls back to its cookie. */
export async function touchLastSeen(_db: Db): Promise<string | null> {
  return null;
}
