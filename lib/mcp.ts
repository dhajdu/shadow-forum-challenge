// MCP tools for The Shadow Forum: everything a member can do on the website, from
// their own AI assistant. Every tool runs on the calling member's own Supabase
// client (their OAuth access token), so RLS applies, including the join-date rule.
// Agenda text also goes through visibleAgendaMd, because each agenda repeats the
// running Parking Lot. Never import the service-role client here; eslint enforces it.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, GoalStatus } from "@/lib/database.types";
import { NO_RECORD, readerOf, searchAgendas, type AgendaReader } from "@/lib/ask";
import { goalSeasonId, saveGoalMeasure, createRiderGoal } from "@/lib/goals";
import { parseRecap, visibleAgendaMd, visibleParking } from "@/app/_data/recap";
import { getKitty, parseVnd, vndFull, IN_CATEGORIES, OUT_CATEGORIES } from "@/app/_data/kitty";
import { listGallery } from "@/app/_data/gallery";
import { timeOf, todayVN } from "@/app/_data/format";
import { AGENDA_KINDS, PLANNING_GUIDE, standardRunSheet } from "@/lib/forum-planning";
import type { Db } from "@/app/_data/types";

type MemberClient = SupabaseClient<Database>;
/** token and site let post_chat_message ask the site to push "new message" to phones, as the website does. */
export type Ctx = { supabase: MemberClient; userId: string; token: string; site: string };
type ToolResult = { content: { type: "text"; text: string }[]; structuredContent?: Record<string, unknown>; isError?: boolean };
type Args = Record<string, unknown>;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (v: Record<string, unknown>): ToolResult => ({ content: [{ type: "text", text: JSON.stringify(v, null, 2) }], structuredContent: v });
const fail = (text: string): ToolResult => ({ content: [{ type: "text", text }], isError: true });
const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const day = (v: unknown) => (typeof v === "string" && DAY.test(v) ? v : null);
const num = (v: unknown) => (v == null || v === "" ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const db = (c: MemberClient) => c as unknown as Db;
const any = (c: MemberClient) => c as unknown as SupabaseClient;

const READ = { readOnlyHint: true } as const;
const WRITE = { readOnlyHint: false, destructiveHint: false } as const;
const obj = (properties: Record<string, unknown> = {}, required: string[] = []) => ({
  type: "object",
  properties,
  ...(required.length ? { required } : {}),
  additionalProperties: false,
});
const S = (description: string) => ({ type: "string", description });
const N = (description: string) => ({ type: "number", description });

export const TOOLS = [
  // ── You and the forum ──
  { name: "whoami", title: "Who am I", description: "Your name, your first forum, and whether you are a founding member, admin or the kitty treasurer.", inputSchema: obj(), annotations: READ },
  { name: "list_members", title: "Forum members", description: "The forum's members: name, first forum and role.", inputSchema: obj(), annotations: READ },
  // ── Forums and agendas ──
  {
    name: "list_meetings",
    title: "List forum meetings",
    description: "Forum meetings you can see, past and planned, newest first. Optional date range (YYYY-MM-DD).",
    inputSchema: obj({ from: S("Earliest date, YYYY-MM-DD"), to: S("Latest date, YYYY-MM-DD") }),
    annotations: READ,
  },
  { name: "next_forum", title: "Next forum", description: "The next planned forum: date, time and place.", inputSchema: obj(), annotations: READ },
  {
    name: "get_agenda",
    title: "Get an agenda",
    description: "One forum's agenda text. Pass meeting_id (from list_meetings) or date (YYYY-MM-DD).",
    inputSchema: obj({ meeting_id: S("Meeting id"), date: S("Forum date, YYYY-MM-DD") }),
    annotations: READ,
  },
  {
    name: "search_agendas",
    title: "Search agendas",
    description: "Search the agendas of forums you can see. Returns matching excerpts with their meeting id and date.",
    inputSchema: obj({ query: S("What to look for"), limit: { type: "integer", minimum: 1, maximum: 10 } }, ["query"]),
    annotations: READ,
  },
  { name: "get_parking_lot", title: "Parking Lot", description: "Topics members asked to bring back to the forum, from the newest agenda.", inputSchema: obj(), annotations: READ },
  // ── Forum planning (reads for everyone, writes for forum admins) ──
  { name: "planning_guide", title: "Forum planning guide", description: "How a Shadow Forum is planned: the standard run sheet, rotation, readiness checks and rules. Read it before planning a forum.", inputSchema: obj(), annotations: READ },
  {
    name: "get_forum_plan",
    title: "Get a forum's plan",
    description: "One forum's plan: host, place, theme, starters, presentations and coaches, planners, run sheet, after-forum activity, members present, a timed standard run sheet and the gaps still open. Pass date (YYYY-MM-DD, any day of a multi-day retreat) or meeting_id; default the next forum.",
    inputSchema: obj({ date: S("Forum date, YYYY-MM-DD"), meeting_id: S("Meeting id") }),
    annotations: READ,
  },
  {
    name: "get_rotation",
    title: "Hosts and presentations",
    description: "Host, presenters and coaches for each forum in a date range (default the next 12 months).",
    inputSchema: obj({ from: S("YYYY-MM-DD"), to: S("YYYY-MM-DD") }),
    annotations: READ,
  },
  {
    name: "update_forum",
    title: "Update a forum",
    description: "Admin: change a forum's host, place, address, theme, title, kind, start time, end date, conversation starters or after-forum activity. Only the fields you pass change. Returns before and after.",
    inputSchema: obj(
      {
        date: S("Forum date, YYYY-MM-DD"),
        host: S("Member name or id; empty string clears it"),
        place: S("Venue name"),
        address: S("Venue address"),
        theme: S("Theme"),
        title: S("Title"),
        kind: { type: "string", enum: ["forum", "away", "retreat", "kickoff"] },
        starts_at: S("Start time, HH:MM in GMT+7"),
        ends_on: S("Last day of a multi-day forum, YYYY-MM-DD"),
        conversation_starters: { type: "array", items: { type: "string" }, description: "The starter questions, in order" },
        after_activity: S("After-forum activity"),
      },
      ["date"]
    ),
    annotations: WRITE,
  },
  {
    name: "set_agenda",
    title: "Set a forum's run sheet",
    description: "Admin: replace a forum's whole run sheet. Items are in order; each has kind, title, and optionally starts_at (HH:MM), minutes, day (YYYY-MM-DD, multi-day agendas), owner (member name or id) and details. Returns before and after.",
    inputSchema: obj(
      {
        date: S("Forum date, YYYY-MM-DD"),
        items: {
          type: "array",
          items: obj(
            {
              kind: { type: "string", enum: [...AGENDA_KINDS] },
              title: S("What it is"),
              starts_at: S("HH:MM"),
              minutes: { type: "integer", minimum: 0, maximum: 1440 },
              day: S("YYYY-MM-DD"),
              owner: S("Member name or id"),
              details: S("Notes, questions, links"),
            },
            ["kind", "title"]
          ),
        },
      },
      ["date", "items"]
    ),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: "set_presentation",
    title: "Set a presentation",
    description: "Admin: set who presents at a forum and who coaches them (kind 'planned', or 'live' for the optional live-coached one). Setting the same presenter again changes the coach.",
    inputSchema: obj({ date: S("Forum date, YYYY-MM-DD"), presenter: S("Member name or id"), coach: S("Member name or id (optional)"), kind: { type: "string", enum: ["planned", "live"] } }, ["date", "presenter"]),
    annotations: WRITE,
  },
  {
    name: "remove_presentation",
    title: "Remove a presentation",
    description: "Admin: take a presenter off a forum.",
    inputSchema: obj({ date: S("Forum date, YYYY-MM-DD"), presenter: S("Member name or id") }, ["date", "presenter"]),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: "set_planners",
    title: "Set planners",
    description: "Admin: set who plans an away forum or retreat. Replaces the current planners.",
    inputSchema: obj({ date: S("Forum date, YYYY-MM-DD"), members: { type: "array", items: { type: "string" }, description: "Member names or ids" } }, ["date", "members"]),
    annotations: WRITE,
  },
  {
    name: "get_roles",
    title: "Forum roles",
    description: "The year's roles: moderator, moderator elect, treasurer, retreat planner. A role with nobody is undecided. Default this year.",
    inputSchema: obj({ year: { type: "integer", minimum: 2025, maximum: 2100 } }),
    annotations: READ,
  },
  {
    name: "set_role",
    title: "Set a forum role",
    description: "Admin: give a member a role for a year, or take it away (remove true). A role can have more than one member (e.g. two retreat planners).",
    inputSchema: obj(
      {
        year: { type: "integer", minimum: 2025, maximum: 2100 },
        role: { type: "string", enum: ["moderator", "moderator_elect", "treasurer", "retreat_planner"] },
        member: S("Member name or id"),
        remove: { type: "boolean", description: "Take the role away instead" },
      },
      ["year", "role", "member"]
    ),
    annotations: WRITE,
  },
  // ── Library ──
  { name: "list_library", title: "Forum library", description: "Forum documents you can read: the vision (Home of the Shadow), the Constitution, Resources and more.", inputSchema: obj(), annotations: READ },
  { name: "get_library_doc", title: "Read a library document", description: "One library document's text, by slug from list_library (e.g. home, constitution, resources).", inputSchema: obj({ slug: S("Document slug") }, ["slug"]), annotations: READ },
  // ── Kitty ──
  {
    name: "get_kitty",
    title: "Kitty balance and ledger",
    description: "The forum kitty: balance, dues per forum, treasurer, and ledger lines (money in and out) you can see. Amounts are in VND.",
    inputSchema: obj({ limit: { type: "integer", minimum: 1, maximum: 200, description: "Ledger lines, newest first (default 30)" } }),
    annotations: READ,
  },
  {
    name: "add_kitty_entry",
    title: "Add to the kitty ledger",
    description:
      "Record money in or out of the forum kitty. Use direction 'out' for an expense (category retreat, forum_away, after_forum, space_rental or other; note says what it was for). Use 'in' for dues, fines or penalties paid. Amount in VND: a number or text like '2.5M' or '750k'.",
    inputSchema: obj(
      {
        direction: { type: "string", enum: ["in", "out"] },
        amount: S("Amount in VND, e.g. 2500000, '2.5M' or '750k'"),
        category: { type: "string", enum: [...new Set([...IN_CATEGORIES, ...OUT_CATEGORIES])] },
        note: S("What it was for. Required for money out."),
        entry_on: S("Date, YYYY-MM-DD (default today)"),
        member: S("Who paid in, or who spent / was paid back: a member's name or id (default you)"),
        forum_date: S("The forum it is for, YYYY-MM-DD (optional)"),
      },
      ["direction", "amount"]
    ),
    annotations: WRITE,
  },
  {
    name: "void_kitty_entry",
    title: "Void a kitty line",
    description: "Strike out a wrong ledger line. It stays in the ledger, marked void with who did it; it cannot be undone.",
    inputSchema: obj({ id: S("Ledger line id from get_kitty") }, ["id"]),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  // ── Chat ──
  {
    name: "read_chat",
    title: "Read the forum chat",
    description: "Recent messages in the forum group chat, oldest first.",
    inputSchema: obj({ limit: { type: "integer", minimum: 1, maximum: 200, description: "Messages (default 50)" }, since: S("Only messages after this date, YYYY-MM-DD") }),
    annotations: READ,
  },
  {
    name: "post_chat_message",
    title: "Post to the forum chat",
    description: "Post a message to the forum group chat as you. Everyone in the forum sees it and gets a notification.",
    inputSchema: obj({ text: S("The message") }, ["text"]),
    annotations: WRITE,
  },
  // ── Goals and contest ──
  { name: "list_seasons", title: "Contest seasons", description: "Contest seasons you can see, with their dates.", inputSchema: obj(), annotations: READ },
  {
    name: "my_goals",
    title: "My goals",
    description: "Your contest goal and your personal goals for a season (default the current one).",
    inputSchema: obj({ season_id: S("Season id from list_seasons (optional)") }),
    annotations: READ,
  },
  {
    name: "set_contest_goal",
    title: "Set my contest goal",
    description: "Lock in your contest goal for a season (default the newest). One per season.",
    inputSchema: obj({ title: S("The goal"), unit: S("Unit, e.g. kg or km"), target_value: N("Target"), target_date: S("YYYY-MM-DD"), season_id: S("Season id (optional)") }, ["title"]),
    annotations: WRITE,
  },
  {
    name: "update_contest_goal",
    title: "Update my contest goal",
    description: "Report progress on your contest goal (default the current season).",
    inputSchema: obj(
      {
        current_value: N("Where you are now"),
        status: { type: "string", enum: ["on_track", "at_risk", "behind", "hit"] },
        note: S("A short note"),
        target_value: N("New target (optional)"),
        unit: S("Unit (optional)"),
        season_id: S("Season id (optional)"),
      },
      ["current_value", "status"]
    ),
    annotations: WRITE,
  },
  {
    name: "add_personal_goal",
    title: "Add a personal goal",
    description: "Add a personal goal for a season (default the current one).",
    inputSchema: obj({ title: S("The goal"), unit: S("Unit (optional)"), target_value: N("Target (optional)"), season_id: S("Season id (optional)") }, ["title"]),
    annotations: WRITE,
  },
  {
    name: "update_personal_goal",
    title: "Update a personal goal",
    description: "Set where you are on one of your personal goals.",
    inputSchema: obj({ id: S("Goal id from my_goals"), current_value: N("Where you are now") }, ["id", "current_value"]),
    annotations: WRITE,
  },
  {
    name: "delete_personal_goal",
    title: "Delete a personal goal",
    description: "Remove one of your personal goals.",
    inputSchema: obj({ id: S("Goal id from my_goals") }, ["id"]),
    annotations: { readOnlyHint: false, destructiveHint: true },
  },
  {
    name: "standings",
    title: "Race standings",
    description: "The contest race: everyone's average score, days and missed days for a season (default the current one).",
    inputSchema: obj({ season_id: S("Season id (optional)") }),
    annotations: READ,
  },
  {
    name: "my_contest",
    title: "My contest",
    description: "Your race position, goals and penalties in the contest seasons you can see.",
    inputSchema: obj(),
    annotations: READ,
  },
  // ── Biometrics ──
  {
    name: "my_biometrics",
    title: "My WHOOP data",
    description: "Your daily WHOOP scores (score, recovery, sleep, strain, HRV, resting HR) and your latest weekly journal analysis.",
    inputSchema: obj({ days: { type: "integer", minimum: 1, maximum: 180, description: "How many days back (default 30)" } }),
    annotations: READ,
  },
  // ── Gallery ──
  {
    name: "list_gallery",
    title: "Forum photos",
    description: "Forum photos you can see, newest first, with captions and links valid for an hour.",
    inputSchema: obj({ limit: { type: "integer", minimum: 1, maximum: 100, description: "Photos (default 20)" } }),
    annotations: READ,
  },
] as const;

type Profile = { id: string; full_name: string; forum_joined_on: string | null; forum_left_on: string | null; is_founding: boolean; is_admin: boolean };

async function profiles(c: MemberClient): Promise<Profile[]> {
  const { data } = await c.from("profiles").select("id, full_name, forum_joined_on, forum_left_on, is_founding, is_admin").order("full_name");
  return (data ?? []) as Profile[];
}

/** One member from a name (any part, case-insensitive) or id; an error text when none or several match. */
function memberFrom(people: Profile[], who: string): Profile | string {
  const match = UUID.test(who) ? people.filter((p) => p.id === who) : people.filter((p) => p.full_name.toLowerCase().includes(who.toLowerCase()));
  if (match.length === 1) return match[0];
  return match.length ? `More than one member matches "${who}". Use their full name.` : `No member matches "${who}".`;
}

const PLAN_COLS = "id, held_on, ends_on, starts_at, title, kind, status, place, address, host_id, theme, conversation_starters, after_activity";
type PlanMeeting = {
  id: string; held_on: string; ends_on: string | null; starts_at: string | null; title: string | null; kind: string; status: string;
  place: string | null; address: string | null; host_id: string | null; theme: string | null; conversation_starters: string[] | null; after_activity: string | null;
};

/** The forum on a date (or the multi-day forum covering it), by id, or the next one. */
async function planMeeting(c: MemberClient, args: Args): Promise<PlanMeeting | null> {
  const q = () => any(c).from("meetings").select(PLAN_COLS);
  const id = str(args.meeting_id);
  const date = day(args.date);
  if (UUID.test(id)) return (await q().eq("id", id).maybeSingle()).data as PlanMeeting | null;
  if (date) {
    const exact = (await q().eq("held_on", date).limit(1).maybeSingle()).data as PlanMeeting | null;
    if (exact) return exact;
    return (await q().lte("held_on", date).gte("ends_on", date).limit(1).maybeSingle()).data as PlanMeeting | null;
  }
  if (id || (args.date != null && args.date !== "")) return null;
  return (await q().gte("held_on", todayVN()).neq("status", "held").order("held_on").limit(1).maybeSingle()).data as PlanMeeting | null;
}

const isAdmin = async (c: MemberClient, userId: string) =>
  !!((await c.from("profiles").select("is_admin").eq("id", userId).maybeSingle()).data as { is_admin: boolean } | null)?.is_admin;

/** Members at a forum: joined on or before it, not left before it. */
const presentAt = (people: Profile[], heldOn: string) =>
  people.filter((p) => (p.is_founding || (p.forum_joined_on != null && p.forum_joined_on <= heldOn)) && (!p.forum_left_on || p.forum_left_on > heldOn));

type Presentation = { meeting_id: string; presenter_id: string; coach_id: string | null; kind: string };
type AgendaItem = { position: number; day: string | null; starts_at: string | null; minutes: number | null; kind: string; title: string; owner_id: string | null; details: string | null };

async function forumPlan(c: MemberClient, m: PlanMeeting) {
  const [people, pres, planners, items] = await Promise.all([
    profiles(c),
    any(c).from("meeting_presentations").select("meeting_id, presenter_id, coach_id, kind").eq("meeting_id", m.id),
    any(c).from("meeting_planners").select("member_id").eq("meeting_id", m.id),
    any(c).from("meeting_agenda_items").select("position, day, starts_at, minutes, kind, title, owner_id, details").eq("meeting_id", m.id).order("position"),
  ]);
  const nameOf = (id: string | null) => (id ? people.find((p) => p.id === id)?.full_name ?? null : null);
  const presentations = ((pres.data ?? []) as Presentation[]).map((p) => ({ presenter: nameOf(p.presenter_id), coach: nameOf(p.coach_id), kind: p.kind }));
  const present = presentAt(people, m.held_on);
  const run_sheet = ((items.data ?? []) as AgendaItem[]).map(({ owner_id, starts_at, ...i }) => ({ ...i, starts_at: starts_at?.slice(0, 5) ?? null, owner: nameOf(owner_id) }));
  const plannerNames = ((planners.data ?? []) as { member_id: string }[]).map((p) => nameOf(p.member_id));
  const gaps: string[] = [];
  if (!m.host_id) gaps.push("No host.");
  if (!m.place) gaps.push("No location: the host chooses it.");
  if (!m.theme) gaps.push("No theme.");
  if (!m.conversation_starters?.length) gaps.push("Conversation starters TBD.");
  if (!presentations.some((p) => p.kind === "planned")) gaps.push("No planned presentation.");
  for (const p of presentations) if (!p.coach) gaps.push(`${p.presenter} has no coach.`);
  if ((m.kind === "away" || m.kind === "retreat") && !plannerNames.length) gaps.push("No planner for this away forum or retreat.");
  if (!run_sheet.length) gaps.push("No run sheet yet: start from standard_run_sheet.");
  const { host_id, ...forum } = m;
  return {
    forum: { ...forum, host: nameOf(host_id), starts_at: m.starts_at ? timeOf(m.starts_at) : null },
    days_until: Math.round((Date.parse(m.held_on) - Date.parse(todayVN())) / 86400000),
    members_present: present.length,
    members: present.map((p) => p.full_name),
    presentations,
    planners: plannerNames,
    run_sheet,
    standard_run_sheet: standardRunSheet(present.length),
    gaps,
  };
}

const ADMIN_ONLY = "Only a forum admin can change the plan.";
const ROLES = ["moderator", "moderator_elect", "treasurer", "retreat_planner"] as const;
const HHMM = /^\d{1,2}:\d{2}$/;

async function meetingBy(c: MemberClient, args: Args) {
  const id = str(args.meeting_id);
  const date = day(args.date);
  const q = c.from("meetings").select("id, held_on, starts_at, title, kind, status, place");
  if (UUID.test(id)) return (await q.eq("id", id).maybeSingle()).data;
  if (date) return (await q.eq("held_on", date).limit(1).maybeSingle()).data;
  return null;
}

async function agendaText(c: MemberClient, meetingId: string, heldOn: string, reader: AgendaReader) {
  const { data } = await c.from("meeting_docs").select("title, body_md").eq("meeting_id", meetingId);
  return (data ?? []).map((d) => ({ title: d.title, text: visibleAgendaMd(d.body_md, heldOn, reader.forum_joined_on, reader.is_founding) }));
}

export async function callTool(name: string, args: Args, ctx: Ctx): Promise<ToolResult> {
  const { supabase: c, userId } = ctx;
  switch (name) {
    case "whoami": {
      const [{ data: me }, kitty] = await Promise.all([
        c.from("profiles").select("full_name, email, forum_joined_on, is_founding, is_admin").eq("id", userId).maybeSingle(),
        any(c).from("kitty_settings").select("treasurer_id").maybeSingle(),
      ]);
      return json({ ...(me ?? {}), is_treasurer: (kitty.data as { treasurer_id: string | null } | null)?.treasurer_id === userId, today: todayVN() });
    }
    case "list_members": {
      const today = todayVN();
      const people = (await profiles(c)).filter((p) => !p.forum_left_on || p.forum_left_on > today);
      return json({
        members: people.map((p) => ({ id: p.id, name: p.full_name, first_forum: p.is_founding ? "founding member" : p.forum_joined_on, admin: p.is_admin })),
      });
    }
    case "list_meetings": {
      let q = c.from("meetings").select("id, held_on, starts_at, title, kind, status, place").order("held_on", { ascending: false }).limit(100);
      if (day(args.from)) q = q.gte("held_on", day(args.from)!);
      if (day(args.to)) q = q.lte("held_on", day(args.to)!);
      const { data, error } = await q;
      if (error) return fail("Could not list meetings.");
      return json({ meetings: data ?? [] });
    }
    case "next_forum": {
      const { data } = await c
        .from("meetings")
        .select("id, held_on, starts_at, title, kind, status, place")
        .gte("held_on", todayVN())
        .neq("status", "held")
        .order("held_on")
        .limit(1)
        .maybeSingle();
      return json({ next: data ?? null });
    }
    case "get_agenda": {
      const meeting = await meetingBy(c, args);
      // Same answer for "not there" and "not yours", so nothing is confirmed.
      if (!meeting) return fail("No agenda found.");
      return json({ meeting, docs: await agendaText(c, meeting.id, meeting.held_on, await readerOf(c, userId)) });
    }
    case "search_agendas": {
      const query = str(args.query);
      if (!query) return fail("Give a query.");
      const limit = Math.min(10, Math.max(1, Number(args.limit) || 5));
      const hits = await searchAgendas(c, query, { limit, reader: await readerOf(c, userId) });
      if (hits.length === 0) return json({ results: [], note: NO_RECORD });
      return json({
        results: hits.map((h) => ({ meeting_id: h.meeting_id, held_on: h.held_on, title: h.title, excerpt: h.content, rank: Math.round(h.rank * 1000) / 1000 })),
      });
    }
    case "get_parking_lot": {
      const reader = await readerOf(c, userId);
      const { data: held } = await c.from("meetings").select("id, held_on").eq("status", "held").order("held_on", { ascending: false }).limit(5);
      for (const m of held ?? []) {
        const { data: docs } = await c.from("meeting_docs").select("body_md").eq("meeting_id", m.id);
        const md = (docs ?? []).map((d) => d.body_md).join("\n\n");
        if (!md.trim()) continue;
        const groups = visibleParking(parseRecap(md, m.held_on).parking, reader.forum_joined_on, reader.is_founding);
        return json({ as_of: m.held_on, groups });
      }
      return json({ as_of: null, groups: [] });
    }
    case "list_library": {
      const { data } = await c.from("library_docs").select("slug, title, audience, updated_at").order("sort");
      return json({ docs: data ?? [] });
    }
    case "get_library_doc": {
      const { data } = await c.from("library_docs").select("slug, title, body_md, updated_at").eq("slug", str(args.slug, 100)).maybeSingle();
      return data ? json({ doc: data }) : fail("No such document.");
    }
    case "get_kitty": {
      const [k, people] = await Promise.all([getKitty(db(c)), profiles(c)]);
      const nameOf = new Map(people.map((p) => [p.id, p.full_name]));
      const limit = Math.min(200, Math.max(1, Number(args.limit) || 30));
      return json({
        balance_vnd: k.balance,
        balance: k.balance == null ? null : vndFull(k.balance),
        dues_per_forum_vnd: k.dues,
        treasurer: k.treasurerId ? nameOf.get(k.treasurerId) ?? null : null,
        entries: k.entries.slice(0, limit).map((e) => ({
          id: e.id,
          date: e.entry_on,
          direction: e.direction,
          amount_vnd: e.amount_vnd,
          category: e.category,
          member: e.member_id ? nameOf.get(e.member_id) ?? null : null,
          note: e.note,
          added_by: e.created_by ? nameOf.get(e.created_by) ?? null : null,
          void: !!e.voided_at,
        })),
      });
    }
    case "add_kitty_entry": {
      const direction = args.direction === "out" ? "out" : args.direction === "in" ? "in" : null;
      if (!direction) return fail("direction must be 'in' or 'out'.");
      const amount = parseVnd(String(args.amount ?? ""));
      if (!amount) return fail("Give an amount in VND, like 2.5M or 2,500,000.");
      const note = str(args.note) || null;
      if (direction === "out" && !note) return fail("Say what the money went on (note).");
      const allowed: readonly string[] = direction === "out" ? OUT_CATEGORIES : IN_CATEGORIES;
      const category = allowed.includes(String(args.category)) ? String(args.category) : direction === "in" ? "dues" : "other";
      let memberId: string | null = userId;
      const who = str(args.member, 100);
      if (who) {
        const people = await profiles(c);
        const match = UUID.test(who) ? people.filter((p) => p.id === who) : people.filter((p) => p.full_name.toLowerCase().includes(who.toLowerCase()));
        if (match.length !== 1) return fail(match.length ? `More than one member matches "${who}". Use their full name.` : `No member matches "${who}".`);
        memberId = match[0].id;
      }
      let meetingId: string | null = null;
      if (day(args.forum_date)) {
        const m = await meetingBy(c, { date: args.forum_date });
        if (!m) return fail("No forum on that date.");
        meetingId = m.id;
      }
      const { data, error } = await any(c)
        .from("kitty_entries")
        .insert({ direction, amount_vnd: amount, category, member_id: memberId, meeting_id: meetingId, note, ...(day(args.entry_on) ? { entry_on: day(args.entry_on) } : {}) })
        .select("id, entry_on, direction, amount_vnd, category, note")
        .single();
      if (error) return fail("Could not save that line. Dates before your first forum can't be used.");
      return json({ saved: data, amount: vndFull(amount) });
    }
    case "void_kitty_entry": {
      const id = str(args.id);
      if (!UUID.test(id)) return fail("Give the line's id from get_kitty.");
      const { data, error } = await any(c).from("kitty_entries").update({ voided_at: new Date().toISOString() }).eq("id", id).select("id");
      if (error || !data?.length) return fail("No such line, or it is already void.");
      return json({ voided: id });
    }
    case "read_chat": {
      const limit = Math.min(200, Math.max(1, Number(args.limit) || 50));
      let q = any(c).from("forum_messages").select("id, author_id, body, created_at, edited_at").is("deleted_at", null).order("created_at", { ascending: false }).limit(limit);
      if (day(args.since)) q = q.gt("created_at", `${day(args.since)}T23:59:59+07:00`);
      const [{ data }, people] = await Promise.all([q, profiles(c)]);
      const nameOf = new Map(people.map((p) => [p.id, p.full_name]));
      const rows = ((data ?? []) as { id: string; author_id: string; body: string; created_at: string; edited_at: string | null }[]).reverse();
      return json({ messages: rows.map((m) => ({ id: m.id, from: nameOf.get(m.author_id) ?? "Member", at: m.created_at, text: m.body, edited: !!m.edited_at })) });
    }
    case "post_chat_message": {
      const body = str(args.text, 4000);
      if (!body) return fail("Write a message.");
      const { data, error } = await any(c).from("forum_messages").insert({ body }).select("id, created_at").single();
      if (error || !data) return fail("Could not post the message.");
      // the same push the website sends; the site rate-limits it and never shows the text on the lock screen
      await fetch(`${ctx.site}/api/forum/notify`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${ctx.token}` },
        body: JSON.stringify({ message_id: (data as { id: string }).id }),
      }).catch(() => null);
      return json({ posted: data });
    }
    case "list_seasons": {
      const { data } = await c.from("seasons").select("id, slug, name, starts_on, ends_on").order("starts_on");
      return json({ seasons: data ?? [] });
    }
    case "my_goals": {
      const season = await goalSeasonId(c, "update", str(args.season_id) || null);
      if (!season) return json({ season_id: null, contest_goal: null, personal_goals: [] });
      const [{ data: goal }, { data: personal }] = await Promise.all([
        c.from("goals").select("id, title, unit, target_value, current_value, current_status, target_date").eq("user_id", userId).eq("season_id", season).maybeSingle(),
        any(c).from("personal_goals").select("id, title, unit, target_value, current_value").eq("user_id", userId).eq("season_id", season).order("created_at"),
      ]);
      return json({ season_id: season, contest_goal: goal ?? null, personal_goals: personal ?? [] });
    }
    case "set_contest_goal": {
      const error = await createRiderGoal(c, userId, { title: str(args.title, 200), unit: str(args.unit, 40) || null, targetValue: num(args.target_value), targetDate: day(args.target_date) }, str(args.season_id) || null);
      if (error === "exists") return fail("You already have a contest goal this season. Use update_contest_goal.");
      return error ? fail(error) : json({ ok: true });
    }
    case "update_contest_goal": {
      const status = (["on_track", "at_risk", "behind", "hit"].includes(String(args.status)) ? args.status : "on_track") as GoalStatus;
      const current = num(args.current_value);
      if (current == null) return fail("Give current_value as a number.");
      const error = await saveGoalMeasure(c, userId, { currentValue: current, targetValue: num(args.target_value), unit: str(args.unit, 40) || null, status, note: str(args.note) || null }, str(args.season_id) || null);
      return error ? fail(error) : json({ ok: true });
    }
    case "add_personal_goal": {
      const title = str(args.title, 200);
      const season = await goalSeasonId(c, "update", str(args.season_id) || null);
      if (!title || !season) return fail(!title ? "Give the goal a title." : "No season to add it to.");
      const { data, error } = await any(c)
        .from("personal_goals")
        .insert({ user_id: userId, season_id: season, title, unit: str(args.unit, 40) || null, target_value: num(args.target_value), current_value: 0 })
        .select("id, title")
        .single();
      return error ? fail("Could not add the goal.") : json({ added: data });
    }
    case "update_personal_goal": {
      const current = num(args.current_value);
      if (!UUID.test(str(args.id)) || current == null) return fail("Give the goal id and current_value.");
      const { data } = await any(c).from("personal_goals").update({ current_value: current }).eq("id", str(args.id)).eq("user_id", userId).select("id");
      return data?.length ? json({ ok: true }) : fail("No such goal.");
    }
    case "delete_personal_goal": {
      if (!UUID.test(str(args.id))) return fail("Give the goal id.");
      const { data } = await any(c).from("personal_goals").delete().eq("id", str(args.id)).eq("user_id", userId).select("id");
      return data?.length ? json({ deleted: str(args.id) }) : fail("No such goal.");
    }
    case "standings": {
      const season = await goalSeasonId(c, "update", str(args.season_id) || null);
      if (!season) return json({ season_id: null, standings: [] });
      const { data } = await c.from("season_standings").select("user_id, full_name, contest_avg, contest_days, contest_missed, last_data_day").eq("season_id", season);
      const rows = ((data ?? []) as { user_id: string; full_name: string; contest_avg: number; contest_days: number; contest_missed: number; last_data_day: string | null }[]).sort((a, b) => b.contest_avg - a.contest_avg);
      return json({ season_id: season, standings: rows.map((r, i) => ({ rank: i + 1, name: r.full_name, avg: r.contest_avg, days: r.contest_days, missed: r.contest_missed, last_data_day: r.last_data_day, you: r.user_id === userId })) });
    }
    case "my_contest": {
      const [{ data: seasons }, { data: goal }, { data: race }, { data: penalties }] = await Promise.all([
        c.from("seasons").select("id, slug, name, starts_on, ends_on").order("starts_on"),
        c.from("goals").select("title, unit, target_value, current_value, current_progress, current_status, season_id").eq("user_id", userId),
        c.from("race_standings").select("user_id, full_name, contest_avg, contest_days, contest_missed"),
        c.from("penalties").select("kind, amount_m, reason, period, season_id").eq("user_id", userId),
      ]);
      const board = (race ?? []).sort((a, b) => b.contest_avg - a.contest_avg);
      const rank = board.findIndex((r) => r.user_id === userId);
      return json({
        seasons: seasons ?? [],
        goals: goal ?? [],
        race: rank >= 0 ? { rank: rank + 1, riders: board.length, avg: board[rank].contest_avg, days: board[rank].contest_days, missed: board[rank].contest_missed } : null,
        penalties: penalties ?? [],
      });
    }
    case "my_biometrics": {
      const back = Math.min(180, Math.max(1, Number(args.days) || 30));
      const from = new Date(Date.now() - back * 86400000).toISOString().slice(0, 10);
      const [{ data: days }, { data: analysis }] = await Promise.all([
        c.from("whoop_days").select("day, score, recovery, sleep, strain, hrv, resting_hr, missed").eq("user_id", userId).gte("day", from).order("day"),
        c.from("journal_analyses").select("week_of, headline, insights, suggestion").eq("user_id", userId).order("week_of", { ascending: false }).limit(1).maybeSingle(),
      ]);
      return json({ days: days ?? [], latest_journal_analysis: analysis ?? null });
    }
    case "list_gallery": {
      const photos = await listGallery(db(c), Math.min(100, Math.max(1, Number(args.limit) || 20)));
      return json({ photos: photos.map((p) => ({ id: p.id, taken_on: p.taken_on, caption: p.caption, by: p.uploader, url: p.web, thumb: p.thumb })) });
    }
    case "planning_guide":
      return { content: [{ type: "text", text: PLANNING_GUIDE }] };
    case "get_forum_plan": {
      const m = await planMeeting(c, args);
      return m ? json(await forumPlan(c, m)) : fail("No forum found.");
    }
    case "get_rotation": {
      const from = day(args.from) ?? todayVN();
      const to = day(args.to) ?? `${Number(from.slice(0, 4)) + 1}${from.slice(4)}`;
      const [{ data: ms }, people] = await Promise.all([
        any(c).from("meetings").select("id, held_on, ends_on, kind, title, place, host_id").gte("held_on", from).lte("held_on", to).order("held_on"),
        profiles(c),
      ]);
      const meetings = (ms ?? []) as { id: string; held_on: string; ends_on: string | null; kind: string; title: string | null; place: string | null; host_id: string | null }[];
      const { data: pres } = meetings.length
        ? await any(c).from("meeting_presentations").select("meeting_id, presenter_id, coach_id, kind").in("meeting_id", meetings.map((m) => m.id))
        : { data: [] };
      const nameOf = (id: string | null) => (id ? people.find((p) => p.id === id)?.full_name ?? null : null);
      return json({
        forums: meetings.map((m) => ({
          date: m.held_on,
          ends_on: m.ends_on,
          kind: m.kind,
          title: m.title,
          place: m.place,
          host: nameOf(m.host_id),
          presentations: ((pres ?? []) as Presentation[]).filter((p) => p.meeting_id === m.id).map((p) => ({ presenter: nameOf(p.presenter_id), coach: nameOf(p.coach_id), kind: p.kind })),
        })),
      });
    }
    case "update_forum": {
      if (!(await isAdmin(c, userId))) return fail(ADMIN_ONLY);
      const m = await planMeeting(c, { date: args.date });
      if (!m) return fail("No forum found on that date.");
      const patch: Record<string, unknown> = {};
      for (const k of ["place", "address", "theme", "title", "after_activity"] as const) if (typeof args[k] === "string") patch[k] = str(args[k]) || null;
      if (typeof args.host === "string") {
        if (!str(args.host)) patch.host_id = null;
        else {
          const who = memberFrom(await profiles(c), str(args.host, 100));
          if (typeof who === "string") return fail(who);
          patch.host_id = who.id;
        }
      }
      if (args.kind !== undefined) {
        if (!["forum", "away", "retreat", "kickoff"].includes(String(args.kind))) return fail("kind must be forum, away, retreat or kickoff.");
        patch.kind = args.kind;
      }
      if (typeof args.starts_at === "string") {
        if (args.starts_at && !HHMM.test(args.starts_at)) return fail("starts_at is HH:MM.");
        patch.starts_at = args.starts_at ? `${m.held_on}T${args.starts_at.padStart(5, "0")}:00+07:00` : null;
      }
      if (args.ends_on !== undefined) {
        if (args.ends_on && !day(args.ends_on)) return fail("ends_on is YYYY-MM-DD.");
        patch.ends_on = day(args.ends_on);
      }
      if (Array.isArray(args.conversation_starters)) patch.conversation_starters = args.conversation_starters.map((q) => str(q)).filter(Boolean);
      if (!Object.keys(patch).length) return fail("Nothing to change.");
      const before = (await forumPlan(c, m)).forum;
      const { data, error } = await any(c).from("meetings").update(patch).eq("id", m.id).select(PLAN_COLS).single();
      if (error || !data) return fail("Could not update the forum.");
      return json({ before, after: (await forumPlan(c, data as PlanMeeting)).forum });
    }
    case "set_agenda": {
      if (!(await isAdmin(c, userId))) return fail(ADMIN_ONLY);
      const m = await planMeeting(c, { date: args.date });
      if (!m) return fail("No forum found on that date.");
      if (!Array.isArray(args.items)) return fail("Give items as a list.");
      const people = await profiles(c);
      const items: Record<string, unknown>[] = [];
      for (const [n, raw] of (args.items as Args[]).entries()) {
        const kind = String(raw?.kind ?? "");
        const title = str(raw?.title, 300);
        if (!(AGENDA_KINDS as readonly string[]).includes(kind) || !title) return fail(`Item ${n + 1} needs a valid kind and a title.`);
        if (raw.starts_at && !HHMM.test(String(raw.starts_at))) return fail(`Item ${n + 1}: starts_at is HH:MM.`);
        if (raw.day && !day(raw.day)) return fail(`Item ${n + 1}: day is YYYY-MM-DD.`);
        let owner: string | null = null;
        if (str(raw.owner)) {
          const who = memberFrom(people, str(raw.owner, 100));
          if (typeof who === "string") return fail(`Item ${n + 1}: ${who}`);
          owner = who.id;
        }
        items.push({ kind, title, starts_at: raw.starts_at || null, minutes: num(raw.minutes), day: day(raw.day), owner_id: owner, details: str(raw.details, 4000) || null });
      }
      const before = (await forumPlan(c, m)).run_sheet;
      const { error } = await any(c).rpc("set_meeting_agenda", { p_meeting: m.id, p_items: items });
      if (error) return fail("Could not save the run sheet.");
      return json({ before, after: (await forumPlan(c, m)).run_sheet });
    }
    case "set_presentation":
    case "remove_presentation": {
      if (!(await isAdmin(c, userId))) return fail(ADMIN_ONLY);
      const m = await planMeeting(c, { date: args.date });
      if (!m) return fail("No forum found on that date.");
      const people = await profiles(c);
      const presenter = memberFrom(people, str(args.presenter, 100));
      if (typeof presenter === "string") return fail(presenter);
      const before = (await forumPlan(c, m)).presentations;
      if (name === "remove_presentation") {
        const { data } = await any(c).from("meeting_presentations").delete().eq("meeting_id", m.id).eq("presenter_id", presenter.id).select("id");
        if (!data?.length) return fail(`${presenter.full_name} is not presenting then.`);
      } else {
        let coachId: string | null = null;
        if (str(args.coach)) {
          const coach = memberFrom(people, str(args.coach, 100));
          if (typeof coach === "string") return fail(coach);
          if (coach.id === presenter.id) return fail("A presenter cannot coach themselves.");
          coachId = coach.id;
        }
        const { error } = await any(c)
          .from("meeting_presentations")
          .upsert({ meeting_id: m.id, presenter_id: presenter.id, coach_id: coachId, kind: args.kind === "live" ? "live" : "planned" }, { onConflict: "meeting_id,presenter_id" });
        if (error) return fail("Could not save the presentation.");
      }
      return json({ before, after: (await forumPlan(c, m)).presentations });
    }
    case "set_planners": {
      if (!(await isAdmin(c, userId))) return fail(ADMIN_ONLY);
      const m = await planMeeting(c, { date: args.date });
      if (!m) return fail("No forum found on that date.");
      if (!Array.isArray(args.members)) return fail("Give members as a list.");
      const people = await profiles(c);
      const ids: string[] = [];
      for (const w of args.members) {
        const who = memberFrom(people, str(w, 100));
        if (typeof who === "string") return fail(who);
        if (!ids.includes(who.id)) ids.push(who.id);
      }
      const before = (await forumPlan(c, m)).planners;
      let del = any(c).from("meeting_planners").delete().eq("meeting_id", m.id);
      if (ids.length) del = del.not("member_id", "in", `(${ids.join(",")})`);
      const { error: delError } = await del;
      const { error: insError } = ids.length
        ? await any(c).from("meeting_planners").upsert(ids.map((member_id) => ({ meeting_id: m.id, member_id })), { onConflict: "meeting_id,member_id", ignoreDuplicates: true })
        : { error: null };
      if (delError || insError) return fail("Could not save the planners.");
      return json({ before, after: (await forumPlan(c, m)).planners });
    }
    case "get_roles": {
      const year = Number(args.year) || Number(todayVN().slice(0, 4));
      const [{ data }, people] = await Promise.all([any(c).from("forum_roles").select("role, member_id").eq("year", year), profiles(c)]);
      const rows = (data ?? []) as { role: string; member_id: string }[];
      const roles = Object.fromEntries(
        ROLES.map((r) => [r, rows.filter((x) => x.role === r).map((x) => people.find((p) => p.id === x.member_id)?.full_name ?? "Member")])
      );
      return json({ year, roles });
    }
    case "set_role": {
      if (!(await isAdmin(c, userId))) return fail(ADMIN_ONLY);
      const year = Number(args.year);
      const role = String(args.role);
      if (!Number.isInteger(year) || year < 2025 || year > 2100) return fail("Give a year.");
      if (!(ROLES as readonly string[]).includes(role)) return fail("Unknown role.");
      const who = memberFrom(await profiles(c), str(args.member, 100));
      if (typeof who === "string") return fail(who);
      const { error } = args.remove
        ? await any(c).from("forum_roles").delete().eq("year", year).eq("role", role).eq("member_id", who.id)
        : await any(c).from("forum_roles").upsert({ year, role, member_id: who.id }, { onConflict: "year,role,member_id", ignoreDuplicates: true });
      if (error) return fail("Could not save the role.");
      return callTool("get_roles", { year }, ctx);
    }
    default:
      return fail(`Unknown tool: ${name}`);
  }
}
