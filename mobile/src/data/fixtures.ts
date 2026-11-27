// Typed fixtures, one set per member persona. Each set is what the database WOULD return to
// that member under row-level security (can_see_date / can_see_season / library audience).
// The app never filters these itself: a persona's set is already "the server's answer".
// No real agenda content lives here; text is placeholder only.
import type { GoalStatus } from "@shared/database.types";
import type { ForumProfile, LibraryDoc, Meeting, MeetingDoc, Season } from "@shared/forum";
import type {
  ChatMessage,
  ForumMessage,
  Goal,
  GoalSummary,
  JournalAnalysis,
  Member,
  PersonalGoal,
  Snapshot,
  Standing,
  Upload,
  WhoopDay,
  WhoopStatus,
} from "./types";

export type Persona = "founding" | "nam" | "minhanh";

const m = (
  held_on: string,
  title: string | null,
  kind: Meeting["kind"],
  place: string | null,
  status: Meeting["status"] = "held",
  starts_at: string | null = null,
): Meeting => ({
  id: `00000000-0000-4000-8000-${held_on.replace(/-/g, "").padStart(12, "0")}`,
  held_on,
  starts_at,
  place,
  title,
  kind,
  status,
  lark_node_token: status === "held" ? `sample-${held_on}` : null,
});

const ALL_MEETINGS: Meeting[] = [
  m("2026-12-23", "Forum", "forum", "Dreamplex", "planned", "2026-12-23T18:00:00+07:00"),
  m("2026-11-25", "Forum Dreamplex", "forum", "Dreamplex"),
  m("2026-10-08", "Mini Retreat", "retreat", null),
  m("2026-09-22", "Forum", "forum", null),
  m("2026-08-24", "Forum", "forum", null),
  m("2026-07-28", "Forum", "forum", null),
  m("2026-05-25", "Forum Manila", "forum", "Manila"),
  m("2026-04-28", "Forum", "forum", null),
  m("2026-03-05", "Forum", "forum", null),
  m("2026-02-05", "Forum", "forum", null),
  m("2026-01-19", "Kickoff", "kickoff", null),
];

const AGENDA = (mt: Meeting): MeetingDoc => ({
  id: `d-${mt.held_on}`,
  meeting_id: mt.id,
  title: "Agenda",
  body_md: ["1 · Opening and confidentiality", "2 · Updates, 5 min each", "3 · Presentation", "4 · Parking lot"].join("\n"),
  source_updated_at: `${mt.held_on}T12:00:00Z`,
});

const doc = (id: string, slug: string, title: string, audience: LibraryDoc["audience"], sort: number, body: string): LibraryDoc => ({
  id,
  slug,
  title,
  audience,
  sort,
  body_md: body,
  file_path: null,
});

const LIBRARY: LibraryDoc[] = [
  doc("l1", "constitution", "Approved Constitution", "all", 1, "Sample text. The approved constitution is imported from Lark."),
  doc("l2", "resources", "Resources", "all", 2, "Sample text. Resources are imported from Lark."),
  doc("l3", "expense-sheet", "Expense Sheet", "founding", 3, "Sample text. Founding members only."),
];

const Q4: Season = { id: "s-2026-q4", slug: "2026-q4", name: "Q4 2026", starts_on: "2026-10-01", ends_on: "2026-12-31", metric: "avg day score" };

const ME_FOUNDING = "u-dave";
const ME_NAM = "u-nam";

const st = (user_id: string, full_name: string, contest_avg: number, contest_days: number, contest_missed: number, last_data_day: string): Standing => ({
  user_id,
  full_name,
  contest_avg,
  contest_days,
  contest_missed,
  all_avg: contest_avg - 1.5,
  all_days: contest_days * 4,
  last_data_day,
});

const STANDINGS: Standing[] = [
  st("u-a", "Rider A", 74.2, 64, 1, "2026-11-26"),
  st(ME_FOUNDING, "Dave Hajdu", 71.4, 63, 2, "2026-11-24"),
  st("u-c", "Rider C", 66.0, 62, 3, "2026-11-26"),
  st("u-d", "Rider D", 62.3, 60, 4, "2026-11-25"),
  st(ME_NAM, "Nam Trung", 58.1, 55, 9, "2026-11-17"),
];

const goal = (user_id: string, title: string, status: GoalStatus, progress: number, coach: string): Goal => ({
  id: `g-${user_id}`,
  user_id,
  title,
  unit: "deals",
  target_value: 3,
  current_value: Math.round((progress / 100) * 3 * 10) / 10,
  current_progress: progress,
  current_status: status,
  locked: true,
  target_date: "2026-12-31",
  coach_name: coach,
});

const GOALS: Record<string, Goal> = {
  [ME_FOUNDING]: goal(ME_FOUNDING, "Close 3 enterprise deals by 31 Dec", "on_track", 70, "Rider C"),
  [ME_NAM]: goal(ME_NAM, "Launch the new product line by 15 Dec", "at_risk", 45, "Dave Hajdu"),
  "u-a": goal("u-a", "Hire a head of sales", "hit", 100, "Rider D"),
  "u-c": goal("u-c", "Reach 2B VND monthly revenue", "on_track", 80, "Rider A"),
  "u-d": goal("u-d", "Open the second store", "behind", 30, "Nam Trung"),
};

/** Deterministic WHOOP-like history from the contest start (with a few gaps) to `to`. */
function days(seed: number, to: string): WhoopDay[] {
  const out: WhoopDay[] = [];
  const end = Date.parse(`${to}T00:00:00Z`);
  for (let i = 120; i >= 0; i--) {
    if ((i + seed) % 23 === 0) continue; // missed day
    const day = new Date(end - i * 86_400_000).toISOString().slice(0, 10);
    const w = Math.sin((i + seed) * 1.7) * 12 + Math.sin(i / 9) * 5;
    const recovery = Math.round(62 + w);
    const sleep = Math.round(80 + w / 2);
    const strain = Math.round((11 + w / 4) * 10) / 10;
    out.push({
      day,
      recovery,
      sleep,
      strain,
      hrv: Math.round(55 + w),
      resting_hr: Math.round(56 - w / 3),
      score: Math.round(((recovery + sleep + (strain / 21) * 100) / 3) * 10) / 10,
    });
  }
  return out;
}

const profile = (id: string, full_name: string, joined: string, admin: boolean, founding: boolean): ForumProfile => ({
  id,
  full_name,
  avatar_url: null,
  forum_joined_on: joined,
  forum_left_on: null,
  is_admin: admin,
  is_founding: founding,
});

const mem = (id: string, full_name: string, joined: string | null, founding: boolean, status: Member["status"], admin = false): Member => ({
  id,
  full_name,
  email: null,
  forum_joined_on: joined,
  forum_left_on: null,
  is_founding: founding,
  is_admin: admin,
  status,
});

const MEMBERS: Member[] = [
  mem(ME_FOUNDING, "Dave Hajdu", "2026-01-19", true, "active", true),
  mem("u-a", "Founding member 2", "2026-01-19", true, "active"),
  mem("u-c", "Founding member 3", "2026-01-19", true, "active"),
  mem("u-d", "Founding member 4", "2026-01-19", true, "active"),
  mem(ME_NAM, "Nam Trung", "2026-07-28", false, "active"),
  mem("u-ma", "Minh Anh", "2026-12-23", false, "invited"),
  mem("u-dn", "Daniel", null, false, "invited"),
];

const SNAPSHOTS: Snapshot[] = [
  { day: "2026-10-26", data: [{ user_id: ME_FOUNDING, rank: 1 }, { user_id: "u-a", rank: 2 }, { user_id: "u-c", rank: 3 }, { user_id: ME_NAM, rank: 4 }, { user_id: "u-d", rank: 5 }] },
  { day: "2026-11-23", data: [{ user_id: "u-a", rank: 1 }, { user_id: "u-c", rank: 2 }, { user_id: ME_FOUNDING, rank: 3 }, { user_id: "u-d", rank: 4 }, { user_id: ME_NAM, rank: 5 }] },
];

const JOURNAL: JournalAnalysis = {
  week_of: "2026-11-23",
  headline: "Sample: late meals cost you recovery this week.",
  insights: [
    { title: "No caffeine after 2 pm", detail: "Sample insight. Recovery averaged higher on these days.", effect: "helps" },
    { title: "Late meal", detail: "Sample insight. Sleep performance dropped the next night.", effect: "hurts" },
  ],
  suggestion: "Sample suggestion: finish dinner three hours before bed.",
};

export type FixtureSet = {
  profile: ForumProfile;
  meetings: Meeting[];
  docs: Record<string, MeetingDoc>;
  library: LibraryDoc[];
  seasons: Season[];
  standings: Standing[];
  goals: Record<string, Goal>;
  personal: PersonalGoal[];
  days: Record<string, WhoopDay[]>;
  snapshots: Snapshot[];
  journal: JournalAnalysis | null;
  whoop: WhoopStatus;
  uploads: Upload[];
  members: Member[]; // admin-only API; empty for everyone else
  chat: ChatMessage[];
  forumChat: ForumMessage[]; // oldest first
};

const fm = (id: string, author_id: string, author: string, created_at: string, body: string, reply_to: string | null = null): ForumMessage => ({
  id,
  author_id,
  author,
  body,
  photo_id: null,
  photo: null,
  reply_to,
  created_at,
  edited_at: null,
  deleted_at: null,
});

const CHAT: ForumMessage[] = [
  fm("c1", "u-a", "Rider A", "2026-11-25T14:05:00Z", "Sample message. Thanks for hosting at Dreamplex."),
  fm("c2", ME_NAM, "Nam Trung", "2026-11-26T02:10:00Z", "Sample message. Who is presenting in December?"),
  fm("c3", ME_FOUNDING, "Dave Hajdu", "2026-11-26T03:00:00Z", "Sample reply. Rider C is up next.", "c2"),
];

const docsFor = (ms: Meeting[]) => Object.fromEntries(ms.filter((x) => x.status === "held").map((x) => [x.id, AGENDA(x)]));
const from = (d: string) => ALL_MEETINGS.filter((x) => x.held_on >= d);

const contest = {
  standings: STANDINGS,
  goals: GOALS,
  days: Object.fromEntries(STANDINGS.map((r, i) => [r.user_id, days(i, r.last_data_day ?? "2026-11-26")])),
  snapshots: SNAPSHOTS,
};

export const fixtures: Record<Persona, FixtureSet> = {
  founding: {
    profile: profile(ME_FOUNDING, "Dave Hajdu", "2026-01-19", true, true),
    meetings: ALL_MEETINGS,
    docs: docsFor(ALL_MEETINGS),
    library: LIBRARY,
    seasons: [Q4],
    ...contest,
    personal: [
      { id: "p1", title: "Read 12 books", unit: "books", target_value: 12, current_value: 9 },
      { id: "p2", title: "Run a half marathon", unit: null, target_value: null, current_value: 0 },
    ],
    journal: JOURNAL,
    whoop: { status: "connected", last_sync_at: "2026-11-27T05:10:00Z" },
    uploads: [{ id: "up1", file_name: "my_whoop_data_2026_11_20.zip", status: "parsed", rows_ingested: 412, created_at: "2026-11-20T03:00:00Z" }],
    members: MEMBERS,
    chat: [],
    forumChat: CHAT,
  },
  nam: {
    profile: profile(ME_NAM, "Nam Trung", "2026-07-28", false, false),
    meetings: from("2026-07-28"),
    docs: docsFor(from("2026-07-28")),
    library: LIBRARY.filter((d) => d.audience === "all"),
    seasons: [Q4],
    ...contest,
    personal: [],
    journal: null,
    whoop: { status: null, last_sync_at: null },
    uploads: [],
    members: [],
    chat: [],
    forumChat: CHAT,
  },
  minhanh: {
    profile: profile("u-ma", "Minh Anh", "2026-12-23", false, false),
    meetings: from("2026-12-23"),
    docs: {},
    library: LIBRARY.filter((d) => d.audience === "all"),
    seasons: [],
    standings: [],
    goals: {},
    personal: [],
    days: {},
    snapshots: [],
    journal: null,
    whoop: { status: null, last_sync_at: null },
    uploads: [],
    members: [],
    chat: [],
    forumChat: [],
  },
};

export const goalSummaries = (set: FixtureSet): GoalSummary[] =>
  Object.values(set.goals).map((g) => ({ user_id: g.user_id, title: g.title, current_status: g.current_status }));
