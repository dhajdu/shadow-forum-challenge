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
import { todayVN } from "@/app/_data/format";
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
    default:
      return fail(`Unknown tool: ${name}`);
  }
}
