// Leak suite for the forum access rule (supabase/migrations/0012_forum_access.sql).
//
// Signs in as six personas and checks every table, storage, the assistant's
// retrieval, the /api routes and the service-role agents. Local Supabase only:
// run it with `npm run test:leak` (supabase/tests/run-leak.sh), which resets the
// local database first. It refuses to run against anything but localhost.
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";
import { memberCanSeeDate, memberCanSeeSeason, seasonOf, type Member, type Season } from "@/lib/access";
import { DEFAULT_FORUM_SETTINGS } from "@/lib/forum-config";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const host = (() => {
  try {
    return new URL(URL_).hostname;
  } catch {
    return "";
  }
})();
if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
  throw new Error(`Leak suite runs only against local Supabase, not "${host || "unset"}".`);
}
process.env.CRON_SECRET = "leak-suite-cron";
process.env.ANTHROPIC_API_KEY = "leak-suite-fake";
delete process.env.RESEND_API_KEY;

type DB = SupabaseClient<Database>;
const admin: DB = createClient<Database>(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

// ── Personas ─────────────────────────────────────────────
type PersonaKey = "founding" | "noah" | "december" | "january" | "leaver" | "nodate";
const PERSONAS: Record<PersonaKey, Omit<Member, "id" | "email">> = {
  founding: { full_name: "Leak Founding", forum_joined_on: "2026-01-19", forum_left_on: null, is_founding: true, is_admin: true },
  noah: { full_name: "Leak Noah Turner", forum_joined_on: "2026-07-28", forum_left_on: null, is_founding: false, is_admin: false },
  december: { full_name: "Leak Mia Archer", forum_joined_on: "2026-12-23", forum_left_on: null, is_founding: false, is_admin: false },
  january: { full_name: "Leak Diego", forum_joined_on: "2027-01-20", forum_left_on: null, is_founding: false, is_admin: false },
  leaver: { full_name: "Leak Leaver", forum_joined_on: "2026-01-19", forum_left_on: "2026-11-01", is_founding: true, is_admin: false },
  nodate: { full_name: "Leak No Date", forum_joined_on: null, forum_left_on: null, is_founding: false, is_admin: false },
};
const KEYS = Object.keys(PERSONAS) as PersonaKey[];
const PASSWORD = `leak-${Math.random().toString(36).slice(2)}-A1!`;

const member: Record<PersonaKey, Member> = {} as never;
const client: Record<PersonaKey, DB> = {} as never;
const token: Record<PersonaKey, string> = {} as never;

// ── Seed ids ─────────────────────────────────────────────
const MEETINGS = [
  { key: "feb", held_on: "2026-02-05", status: "held" as const }, // founding only
  { key: "aug", held_on: "2026-08-24", status: "held" as const }, // + Noah Turner
  { key: "dec", held_on: "2026-12-23", status: "planned" as const }, // + Mia Archer
  { key: "jan", held_on: "2027-01-20", status: "planned" as const }, // + Diego
];
const meetingId: Record<string, string> = {};
const meetingHeld: Record<string, string> = {};
const LEAK_Q4_RULES = { contest_name: "Leak Race", scoring: "whoop", ladder: [0, 2000000, 3000000, 4000000, 5000000], missed_checkin_fine: null };
const LEAK_SEASONS = [
  { slug: "leak-q4", name: "Leak Q4", starts_on: "2026-09-24", ends_on: "2026-12-22", ...LEAK_Q4_RULES },
  { slug: "leak-q1", name: "Leak Q1", starts_on: "2027-01-02", ends_on: "2027-03-31", contest_name: null, scoring: null, ladder: null, missed_checkin_fine: null },
];
let seasons: Season[] = [];
let q4: Season;
let q1: Season;
const goalId: Record<string, string> = {};

const ok = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
  if (r.error) throw new Error(`${what}: ${r.error.message}`);
  return r.data;
};

// Outside calls (Anthropic, Expo) are captured, never sent.
const realFetch = globalThis.fetch;
const anthropicBodies: { system: string; messages: { role: string; content: string }[] }[] = [];
const expoBodies: { to: string; title: string; body: string }[][] = [];
const sse = (events: Record<string, unknown>[]) =>
  events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const u = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (u.startsWith("https://api.anthropic.com/")) {
    anthropicBodies.push(JSON.parse(String(init?.body)));
    const body = sse([
      { type: "message_start", message: { id: "msg_leak", type: "message", role: "assistant", model: "claude-opus-5-5", content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 0 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } },
      { type: "content_block_stop", index: 0 },
      { type: "message_delta", delta: { stop_reason: "end_turn", stop_sequence: null }, usage: { output_tokens: 1 } },
      { type: "message_stop" },
    ]);
    return new Response(body, { headers: { "content-type": "text/event-stream" } });
  }
  if (u.startsWith("https://exp.host/")) {
    const msgs = JSON.parse(String(init?.body)) as { to: string; title: string; body: string }[];
    expoBodies.push(msgs);
    return Response.json({
      data: msgs.map((m) => (m.to.includes("dead") ? { status: "error", details: { error: "DeviceNotRegistered" } } : { status: "ok", id: "t" })),
    });
  }
  return realFetch(input, init);
}) as typeof fetch;

before(async () => {
  // users and their access
  for (const k of KEYS) {
    const email = `leak-${k}@leak.test`;
    const created = await admin.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: PERSONAS[k].full_name },
    });
    if (created.error) throw new Error(`create ${k}: ${created.error.message}`);
    const id = created.data.user.id;
    const p = PERSONAS[k];
    ok(
      await admin
        .from("profiles")
        .update({
          forum_joined_on: p.forum_joined_on,
          forum_left_on: p.forum_left_on,
          is_founding: p.is_founding,
          is_admin: p.is_admin,
        })
        .eq("id", id),
      `access ${k}`
    );
    member[k] = { id, email, ...p };
    const c = createClient<Database>(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const s = await c.auth.signInWithPassword({ email, password: PASSWORD });
    if (s.error) throw new Error(`sign in ${k}: ${s.error.message}`);
    client[k] = c;
    token[k] = s.data.session!.access_token;
  }

  // seasons: the suite's own Q4 2026 (a WHOOP race, no check-in fine) and Q1 2027
  // (no contest). Each starts a day after any season the migrations may seed, so
  // season_of() is unambiguous whether or not those exist.
  ok(await admin.from("seasons").insert(LEAK_SEASONS), "leak seasons");
  seasons = ok(await admin.from("seasons").select("id, slug, name, starts_on, ends_on"), "seasons") as Season[];
  q4 = seasons.find((s) => s.slug === "leak-q4")!;
  q1 = seasons.find((s) => s.slug === "leak-q1")!;
  assert.ok(q4 && q1, "seasons seeded");

  // meetings, docs, chunks, files
  for (const m of MEETINGS) {
    const row = ok(
      await admin.from("meetings").insert({ held_on: m.held_on, status: m.status, title: `Leak ${m.key}` }).select("id").single(),
      `meeting ${m.key}`
    ) as { id: string };
    meetingId[m.key] = row.id;
    meetingHeld[row.id] = m.held_on;
    ok(await admin.from("meeting_docs").insert({ meeting_id: row.id, title: `Agenda ${m.key}`, body_md: `secret agenda ${m.key}\n\nchunk ${m.key} Lisbon trip secretword${m.key}` }), "doc");
    ok(await admin.from("meeting_chunks").insert({ meeting_id: row.id, content: `chunk ${m.key} Lisbon trip secretword${m.key}` }), "chunk");
    ok(
      await admin.storage.from("meeting-files").upload(`${row.id}/agenda.txt`, new Blob([`file ${m.key}`]), { upsert: true }),
      "file"
    );
  }

  // Every agenda repeats the running Parking Lot: the August agenda still lists a February topic.
  const parking = "## Parking Lot\n\n**Feb 5**\n\nLeak Founding - parkfebword topic\n\n**Aug 24**\n\nLeak Noah - parkaugword topic";
  ok(await admin.from("meeting_docs").insert({ meeting_id: meetingId.aug, title: "Parking", body_md: parking }), "parking doc");
  ok(await admin.from("meeting_chunks").insert({ meeting_id: meetingId.aug, content: `Parking\n\n${parking}` }), "parking chunk");

  // kitty: one line from before Noah Turner joined, one after
  for (const [entry_on, note] of [["2026-02-10", "kittyfeb venue"], ["2026-08-24", "kittyaug dues"]] as const) {
    ok(await (admin as unknown as SupabaseClient).from("kitty_entries").insert({ entry_on, direction: "in", amount_vnd: 2_500_000, category: "dues", note, created_by: member.founding.id }), "kitty");
  }

  // forum planning: a presentation, a planner and a host on every meeting; one yearly role
  for (const m of MEETINGS) {
    const id = meetingId[m.key];
    ok(await admin.from("meetings").update({ host_id: member.noah.id, theme: `theme ${m.key}` }).eq("id", id), "host");
    ok(await admin.from("meeting_presentations").insert({ meeting_id: id, presenter_id: member.leaver.id, coach_id: member.noah.id }), "presentation");
    ok(await admin.from("meeting_planners").insert({ meeting_id: id, member_id: member.founding.id }), "planner");
    ok(await admin.from("meeting_agenda_items").insert({ meeting_id: id, position: 1, kind: "lifeline", title: `agendaword${m.key} lifeline`, owner_id: member.noah.id }), "agenda item");
  }
  ok(await admin.from("forum_roles").insert({ year: 2027, role: "moderator", member_id: member.founding.id }), "role");

  // library
  ok(
    await admin.from("library_docs").insert([
      { slug: "leak-constitution", title: "Approved Constitution", audience: "all" },
      { slug: "leak-expense", title: "Expense Sheet", audience: "founding" },
      { slug: "leak-draft", title: "Unlabelled", audience: null },
    ]),
    "library"
  );

  // contest data: goals for the two Q4 riders, Noah Turner coaches the founding member
  for (const k of ["founding", "noah"] as const) {
    const g = ok(
      await admin
        .from("goals")
        .insert({ user_id: member[k].id, title: `Goal ${k}`, season_id: q4.id, coach_id: k === "founding" ? member.noah.id : member.founding.id })
        .select("id")
        .single(),
      `goal ${k}`
    ) as { id: string };
    goalId[k] = g.id;
    ok(await admin.from("goal_progress").insert({ goal_id: g.id, progress: 10, status: "on_track", note: `progress ${k}` }), "progress");
  }
  // one row per insert: a multi-row insert sends null for a column only some rows set
  ok(await admin.from("coaching_notes").insert({ goal_id: goalId.founding, author_id: member.noah.id, body: "note on founding goal" }), "note");
  // dated before Noah Turner joined: only his coach (founding) may see it
  ok(
    await admin
      .from("coaching_notes")
      .insert({ goal_id: goalId.noah, author_id: member.founding.id, body: "backdated note", created_at: "2026-05-01T00:00:00Z" }),
    "backdated note"
  );
  ok(await admin.from("penalties").insert({ user_id: member.founding.id, kind: "placement", amount_m: 2, period: "Q4-2026", season_id: q4.id }), "penalty");
  ok(await admin.from("standings_snapshots").upsert({ day: "2026-10-05", data: [] }, { onConflict: "day" }), "snapshot");

  ok(
    await admin.from("whoop_days").insert([
      { user_id: member.founding.id, day: "2026-03-01", score: 11 }, // before any season: owner only
      { user_id: member.founding.id, day: "2026-10-01", score: 71 },
      { user_id: member.noah.id, day: "2026-10-01", score: 62 },
      { user_id: member.leaver.id, day: "2026-10-01", score: 55 },
      { user_id: member.december.id, day: "2026-12-24", score: 80 },
    ]),
    "whoop days"
  );
  for (const k of KEYS) {
    ok(await admin.from("whoop_journal").insert({ user_id: member[k].id, day: "2026-10-01", question: "Alcohol?", answered_yes: false }), "journal");
    ok(await admin.from("personal_goals").insert({ user_id: member[k].id, title: `personal ${k}` }), "personal");
    ok(await admin.from("push_devices").insert({ user_id: member[k].id, platform: "ios", expo_token: `ExponentPushToken[leak-${k}]` }), "push");
    ok(
      await admin.from("journal_analyses").insert({ user_id: member[k].id, week_of: "2026-10-05", headline: `week ${k}`, insights: [], suggestion: "-", model: "leak" }),
      "journal analysis"
    );
  }
});

after(async () => {
  globalThis.fetch = realFetch;
  // rows that point at the suite's seasons go first; the local reset clears the rest
  const ids = [q4?.id, q1?.id].filter(Boolean);
  if (ids.length) {
    await admin.from("contest_fines").delete().in("season_id", ids);
    for (const t of ["penalties", "personal_goals", "goals"] as const) await admin.from(t).delete().in("season_id", ids);
    await admin.from("seasons").delete().in("id", ids);
  }
});

// ── Expectations, from the rule itself ───────────────────
const active = (k: PersonaKey) => !["leaver", "nodate"].includes(k);
const seesDate = (k: PersonaKey, d: string) => memberCanSeeDate(member[k], d);
const seesSeason = (k: PersonaKey, s: Season | null) => memberCanSeeSeason(member[k], s);

const visibleMeetings = (k: PersonaKey) => MEETINGS.filter((m) => seesDate(k, m.held_on)).map((m) => m.key).sort();
const sorted = (xs: string[]) => [...xs].sort();
const keyOfMeeting = (id: string) => Object.entries(meetingId).find(([, v]) => v === id)?.[0] ?? id;

describe("expectations match the plan's table", () => {
  it("meetings per persona", () => {
    assert.deepEqual(visibleMeetings("founding"), ["aug", "dec", "feb", "jan"]);
    assert.deepEqual(visibleMeetings("noah"), ["aug", "dec", "jan"]);
    assert.deepEqual(visibleMeetings("december"), ["dec", "jan"]);
    assert.deepEqual(visibleMeetings("january"), ["jan"]);
    assert.deepEqual(visibleMeetings("leaver"), []);
    assert.deepEqual(visibleMeetings("nodate"), []);
  });
  it("Q4 season: founding and Noah Turner only", () => {
    assert.deepEqual(KEYS.filter((k) => seesSeason(k, q4)), ["founding", "noah"]);
  });
  it("Q1 2027 (from 2 Jan): every active member, including those whose first forum is in January", () => {
    assert.equal(q1.starts_on, "2027-01-02");
    assert.deepEqual(KEYS.filter((k) => seesSeason(k, q1)), ["founding", "noah", "december", "january"]);
  });
});

describe("lib/access.ts agrees with the database rule", () => {
  const dates = ["2025-12-31", "2026-01-19", "2026-02-05", "2026-07-27", "2026-07-28", "2026-12-22", "2026-12-23", "2027-01-19", "2027-01-20", "2027-06-01"];
  for (const k of KEYS) {
    it(`${k}: member_can_see_date and member_can_see_season`, async () => {
      for (const d of dates) {
        const { data } = await admin.rpc("member_can_see_date", { uid: member[k].id, d });
        assert.equal(data, seesDate(k, d), `${k} ${d}`);
      }
      for (const s of seasons) {
        const { data } = await admin.rpc("member_can_see_season", { uid: member[k].id, s: s.id });
        assert.equal(data, seesSeason(k, s), `${k} ${s.slug}`);
      }
      for (const d of ["2026-03-01", "2026-10-01", "2026-12-24", "2027-02-01"]) {
        const { data } = await admin.rpc("season_of", { d });
        assert.equal(data, seasonOf(seasons, d)?.id ?? null, `season_of ${d}`);
      }
    });
  }
  it("members cannot call the any-member functions", async () => {
    const { error } = await client.noah.rpc("member_can_see_date", { uid: member.founding.id, d: "2026-02-05" });
    assert.ok(error, "member_can_see_date must not be callable by members");
  });
});

describe("tables, per persona", () => {
  for (const k of KEYS) {
    describe(k, () => {
      const c = () => client[k];

      it("meetings, meeting_docs, meeting_chunks", async () => {
        const ms = ok(await c().from("meetings").select("id"), "meetings") as { id: string }[];
        assert.deepEqual(sorted(ms.map((m) => keyOfMeeting(m.id))), visibleMeetings(k));
        const docs = ok(await c().from("meeting_docs").select("meeting_id"), "docs") as { meeting_id: string }[];
        assert.deepEqual(sorted([...new Set(docs.map((d) => keyOfMeeting(d.meeting_id)))]), visibleMeetings(k));
        const chunks = ok(await c().from("meeting_chunks").select("meeting_id, held_on"), "chunks") as { meeting_id: string; held_on: string }[];
        assert.deepEqual(sorted([...new Set(chunks.map((d) => keyOfMeeting(d.meeting_id)))]), visibleMeetings(k));
        for (const ch of chunks) assert.equal(ch.held_on, meetingHeld[ch.meeting_id], "chunk held_on copied from meeting");
      });

      it("assistant retrieval: match_meeting_chunks (full-text)", async () => {
        const hits = ok(await c().rpc("match_meeting_chunks", { query: "What about the Lisbon trip?", match_count: 50 }), "match") as { meeting_id: string }[];
        assert.deepEqual(sorted(hits.map((h) => keyOfMeeting(h.meeting_id))), visibleMeetings(k));
        // a word that only exists in one meeting's agenda: found only if that meeting is visible
        for (const m of MEETINGS) {
          const one = ok(await c().rpc("match_meeting_chunks", { query: `secretword${m.key}` }), "one") as unknown[];
          assert.equal(one.length, seesDate(k, m.held_on) ? 1 : 0, `${k} secretword${m.key}`);
        }
        // scoped to a meeting before their time: nothing, and no error that would confirm it exists
        const pre = await c().rpc("match_meeting_chunks", { query: "Lisbon", only_meeting: meetingId.feb });
        assert.equal(pre.error, null);
        assert.equal((pre.data ?? []).length, seesDate(k, "2026-02-05") ? 1 : 0);
        // stop words alone match nothing
        const noise = ok(await c().rpc("match_meeting_chunks", { query: "what is the" }), "noise") as unknown[];
        assert.equal(noise.length, 0);
      });

      it("storage meeting-files", async () => {
        for (const m of MEETINGS) {
          const path = `${meetingId[m.key]}/agenda.txt`;
          const dl = await c().storage.from("meeting-files").download(path);
          assert.equal(!dl.error && !!dl.data, seesDate(k, m.held_on), `${k} download ${m.key}`);
          const ls = await c().storage.from("meeting-files").list(meetingId[m.key]);
          assert.equal((ls.data ?? []).length > 0, seesDate(k, m.held_on), `${k} list ${m.key}`);
        }
        const up = await c().storage.from("meeting-files").upload(`${meetingId.jan}/${k}.txt`, new Blob(["x"]));
        assert.equal(!up.error, k === "founding", `${k} upload (admins only)`);
      });

      it("library_docs by audience", async () => {
        const rows = ok(await c().from("library_docs").select("slug").like("slug", "leak-%"), "library") as { slug: string }[];
        const expect = !active(k) ? [] : k === "founding" ? ["leak-constitution", "leak-expense"] : ["leak-constitution"];
        assert.deepEqual(sorted(rows.map((r) => r.slug)), expect);
      });

      it("meeting_presentations, meeting_planners, forum_roles", async () => {
        const pres = ok(await c().from("meeting_presentations").select("meeting_id"), "presentations") as { meeting_id: string }[];
        assert.deepEqual(sorted(pres.map((r) => keyOfMeeting(r.meeting_id))), visibleMeetings(k));
        const plan = ok(await c().from("meeting_planners").select("meeting_id"), "planners") as { meeting_id: string }[];
        assert.deepEqual(sorted(plan.map((r) => keyOfMeeting(r.meeting_id))), visibleMeetings(k));
        const roles = ok(await c().from("forum_roles").select("role").eq("year", 2027), "roles") as unknown[];
        assert.equal(roles.length, active(k) ? 1 : 0, "roles: active members only");
        const ins = await c().from("meeting_presentations").insert({ meeting_id: meetingId.jan, presenter_id: member[k].id });
        assert.equal(!ins.error, k === "founding", `${k} presentation insert (admins only)`);
        if (!ins.error) ok(await admin.from("meeting_presentations").delete().eq("meeting_id", meetingId.jan).eq("presenter_id", member[k].id), "cleanup");
        const role = await c().from("forum_roles").insert({ year: 2099, role: "treasurer", member_id: member[k].id });
        assert.equal(!role.error, k === "founding", `${k} role insert (admins only)`);
      });

      it("meeting_agenda_items and set_meeting_agenda", async () => {
        const items = ok(await c().from("meeting_agenda_items").select("meeting_id"), "agenda items") as { meeting_id: string }[];
        assert.deepEqual(sorted(items.map((r) => keyOfMeeting(r.meeting_id))), visibleMeetings(k));
        const ins = await c().from("meeting_agenda_items").insert({ meeting_id: meetingId.jan, position: 99, kind: "other", title: `x ${k}` });
        assert.equal(!ins.error, k === "founding", `${k} agenda insert (admins only)`);
        if (!ins.error) ok(await admin.from("meeting_agenda_items").delete().eq("meeting_id", meetingId.jan).eq("position", 99), "cleanup");
        if (k !== "founding") {
          const rpc = await c().rpc("set_meeting_agenda", { p_meeting: meetingId.jan, p_items: [] });
          assert.ok(rpc.error, `${k} set_meeting_agenda (admins only)`);
          const still = ok(await admin.from("meeting_agenda_items").select("id").eq("meeting_id", meetingId.jan), "still there") as unknown[];
          assert.equal(still.length, 1, "a refused call deletes nothing");
        }
      });

      it("seasons", async () => {
        const rows = ok(await c().from("seasons").select("id"), "seasons") as { id: string }[];
        assert.deepEqual(sorted(rows.map((r) => r.id)), sorted(seasons.filter((s) => seesSeason(k, s)).map((s) => s.id)));
      });

      it("goals, goal_progress, penalties, standings_snapshots, race_standings", async () => {
        const q4Visible = seesSeason(k, q4);
        const goals = ok(await c().from("goals").select("id"), "goals") as { id: string }[];
        assert.equal(goals.length, q4Visible ? 2 : 0, "goals");
        const prog = ok(await c().from("goal_progress").select("goal_id"), "progress") as { goal_id: string }[];
        // owner or coach: founding and Noah Turner coach each other
        assert.equal(prog.length, q4Visible ? 2 : 0, "goal_progress");
        const pen = ok(await c().from("penalties").select("id"), "penalties") as unknown[];
        assert.equal(pen.length, q4Visible ? 1 : 0, "penalties");
        const snaps = ok(await c().from("standings_snapshots").select("day").eq("day", "2026-10-05"), "snapshots") as unknown[];
        assert.equal(snaps.length, q4Visible ? 1 : 0, "snapshots");
        const race = ok(await c().from("race_standings").select("user_id"), "race") as { user_id: string }[];
        const riders = q4Visible ? sorted([member.founding.id, member.noah.id, member.leaver.id]) : [];
        assert.deepEqual(sorted(race.map((r) => r.user_id).filter((id) => Object.values(member).some((m) => m.id === id))), riders);
      });

      it("coaching_notes: party, season and date", async () => {
        const notes = ok(await c().from("coaching_notes").select("body"), "notes") as { body: string }[];
        const expect =
          k === "founding" ? ["backdated note", "note on founding goal"] : k === "noah" ? ["note on founding goal"] : [];
        assert.deepEqual(sorted(notes.map((n) => n.body)), expect);
      });

      it("whoop_days: own, or in a season you can see", async () => {
        const rows = ok(await c().from("whoop_days").select("user_id, day"), "whoop") as { user_id: string; day: string }[];
        const all = [
          ["founding", "2026-03-01"],
          ["founding", "2026-10-01"],
          ["noah", "2026-10-01"],
          ["leaver", "2026-10-01"],
          ["december", "2026-12-24"],
        ] as const;
        const expect = !active(k)
          ? []
          : all.filter(([owner, day]) => owner === k || seesSeason(k, seasonOf(seasons, day))).map(([o, d]) => `${o}:${d}`);
        const keyOf = (id: string) => KEYS.find((x) => member[x].id === id)!;
        assert.deepEqual(sorted(rows.map((r) => `${keyOf(r.user_id)}:${r.day}`)), sorted(expect));
      });

      it("own-only tables: journal, personal goals, push devices, uploads, whoop connection", async () => {
        for (const t of ["whoop_journal", "personal_goals", "push_devices", "journal_analyses"] as const) {
          const rows = ok(await c().from(t).select("user_id"), t) as { user_id: string }[];
          assert.deepEqual(rows.map((r) => r.user_id), active(k) ? [member[k].id] : [], t);
        }
      });

      it("profiles: own row always, others only while active", async () => {
        const rows = ok(await c().from("profiles").select("id"), "profiles") as { id: string }[];
        const ids = rows.map((r) => r.id);
        assert.ok(ids.includes(member[k].id), "own row");
        assert.equal(ids.includes(member.founding.id) || k === "founding", active(k), "others");
      });

      it("cannot change own access columns", async () => {
        for (const patch of [{ forum_joined_on: "2020-01-01" }, { is_admin: true }, { is_founding: true }, { forum_left_on: null }]) {
          const r = await c().from("profiles").update(patch).eq("id", member[k].id);
          assert.ok(r.error, `${k} update ${Object.keys(patch)[0]} must be denied`);
        }
        const fresh = ok(await admin.from("profiles").select("forum_joined_on, is_admin").eq("id", member[k].id).single(), "re-read") as {
          forum_joined_on: string | null;
          is_admin: boolean;
        };
        assert.equal(fresh.forum_joined_on, PERSONAS[k].forum_joined_on);
        assert.equal(fresh.is_admin, PERSONAS[k].is_admin);
        const name = await c().from("profiles").update({ full_name: PERSONAS[k].full_name }).eq("id", member[k].id);
        assert.equal(name.error, null, "name is still editable");
      });

      it("set_member_access is admin-only", async () => {
        const p = PERSONAS.january;
        const r = await c().rpc("set_member_access", {
          member: member.january.id,
          joined_on: k === "founding" ? p.forum_joined_on : "2020-01-01",
          left_on: null,
          founding: false,
          admin: false,
        });
        assert.equal(!r.error, k === "founding");
      });

      it("cannot write forum tables", async () => {
        const r = await c().from("meetings").insert({ held_on: "2026-06-01", title: `by ${k}` }).select("id");
        assert.equal(!r.error, k === "founding", "meetings insert admin-only");
        if (!r.error) await admin.from("meetings").delete().eq("title", `by ${k}`);
        const ch = await c().from("meeting_chunks").insert({ meeting_id: meetingId.jan, content: "x" });
        assert.ok(ch.error, "chunks are service-only");
      });
    });
  }

  it("a member who joined after the season started cannot create a goal in it", async () => {
    const r = await client.december.from("goals").insert({ user_id: member.december.id, title: "late goal" });
    assert.ok(r.error, "goal insert into Q4 denied");
  });
});

// ── /api routes (in-process, Bearer tokens as the iPhone app sends) ──
const req = (path: string, init: { method?: string; token?: string; body?: unknown; cron?: boolean } = {}) =>
  new NextRequest(`http://localhost${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
      ...(init.cron ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

describe("/api routes", () => {
  it("leavers and undated members get 403 from /api/goal, /api/ingest, /api/assistant", async () => {
    const goal = await import("@/app/api/goal/route");
    const ingest = await import("@/app/api/ingest/route");
    const assistant = await import("@/app/api/assistant/route");
    for (const k of ["leaver", "nodate"] as const) {
      const t = token[k];
      assert.equal((await goal.PATCH(req("/api/goal", { method: "PATCH", token: t, body: { currentValue: 1 } }))).status, 403);
      assert.equal((await goal.POST(req("/api/goal", { method: "POST", token: t, body: { title: "x" } }))).status, 403);
      assert.equal((await ingest.POST(req("/api/ingest", { method: "POST", token: t, body: { uploadId: "x" } }))).status, 403);
      const a = await assistant.POST(req("/api/assistant", { method: "POST", token: t, body: { messages: [{ role: "user", content: "hi" }] } }));
      assert.equal(a.status, 403);
    }
  });

  it("the assistant only puts the caller's own data in front of the model", async () => {
    const assistant = await import("@/app/api/assistant/route");
    anthropicBodies.length = 0;
    const r = await assistant.POST(
      req("/api/assistant", { method: "POST", token: token.noah, body: { messages: [{ role: "user", content: "Lisbon trip?" }] } })
    );
    assert.equal(r.status, 200);
    await r.text();
    const sys = String(anthropicBodies[0]?.system ?? "");
    assert.match(sys, /score=62/, "own score present");
    assert.doesNotMatch(sys, /score=71|score=11|score=55|score=80/, "no other rider's days");
    assert.doesNotMatch(sys, /secret agenda|chunk feb/, "no agenda text");
  });

  it("/api/goal PATCH works for an active rider", async () => {
    const goal = await import("@/app/api/goal/route");
    const r = await goal.PATCH(req("/api/goal", { method: "PATCH", token: token.noah, body: { currentValue: 3, targetValue: 10, status: "on_track" } }));
    assert.equal(r.status, 200, JSON.stringify(await r.clone().json()));
  });
});

// ── Service-role agents and group outputs ────────────────
describe("agents (service role) scope to the rule", () => {
  it("Whip nudges only riders in today's season", async () => {
    const { runWhip } = await import("@/lib/agents");
    const res = await runWhip(admin, { dry: true });
    const names = res.stale.map((s) => s.name);
    for (const k of ["december", "january", "leaver", "nodate"] as const) assert.ok(!names.includes(PERSONAS[k].full_name), `${k} not nudged`);
    for (const k of ["founding", "noah"] as const) assert.ok(names.includes(PERSONAS[k].full_name), `${k} considered`);
  });

  it("Chronicler mails the Q4 report only to members who can see Q4", async () => {
    const { GET } = await import("@/app/api/cron/chronicler/route");
    const r = await GET(req("/api/cron/chronicler?dry=1", { cron: true }));
    const body = (await r.json()) as { recipients: number };
    const { data: profs } = await admin.from("profiles").select("id, forum_joined_on, forum_left_on, is_founding, is_admin, full_name, email");
    const expected = ((profs ?? []) as Member[]).filter((m) => memberCanSeeSeason(m, q4) && m.email).length;
    assert.equal(body.recipients, expected);
    assert.ok(expected >= 2);
  });

  it("standings used by the Bookkeeper never include later joiners", async () => {
    const { getStandings } = await import("@/lib/standings");
    const ids = (await getStandings(admin)).map((s) => s.user_id);
    for (const k of ["december", "january", "nodate"] as const) assert.ok(!ids.includes(member[k].id), `${k} not a Q4 rider`);
    for (const k of ["founding", "noah"] as const) assert.ok(ids.includes(member[k].id), `${k} is a Q4 rider`);
  });

  it("cron routes reject calls without the secret", async () => {
    const { GET } = await import("@/app/api/cron/chunks/route");
    assert.equal((await GET(req("/api/cron/chunks"))).status, 401);
  });
});

// ── Ask (agenda retrieval under the rule) ────────────────
const askReq = (k: PersonaKey, body: unknown) => req("/api/ask", { method: "POST", token: token[k], body });

describe("Ask", () => {
  for (const k of ["founding", "noah", "december", "january"] as const) {
    it(`${k}: the model only sees excerpts from meetings ${k} may see`, async () => {
      const { POST } = await import("@/app/api/ask/route");
      anthropicBodies.length = 0;
      const r = await POST(askReq(k, { question: "Lisbon trip?" }));
      assert.equal(r.status, 200);
      const text = await r.text();
      const cited = JSON.parse(decodeURIComponent(r.headers.get("x-cited-meetings") ?? "%5B%5D")) as { id: string }[];
      assert.deepEqual(sorted(cited.map((c) => keyOfMeeting(c.id))), visibleMeetings(k));
      const prompt = JSON.stringify(anthropicBodies);
      for (const m of MEETINGS) assert.equal(prompt.includes(`chunk ${m.key} `), seesDate(k, m.held_on), `${k} excerpt ${m.key}`);
      assert.ok(text.length > 0);
    });
  }

  it("a meeting before the member's time gives the plain no-record answer, without calling the model", async () => {
    const { POST } = await import("@/app/api/ask/route");
    const { NO_RECORD } = await import("@/lib/ask");
    anthropicBodies.length = 0;
    const r = await POST(askReq("noah", { question: "What happened?", meetingId: meetingId.feb }));
    assert.equal(await r.text(), NO_RECORD);
    assert.equal(anthropicBodies.length, 0);
    assert.doesNotMatch(NO_RECORD, /join|before|access|permission/i);
  });

  it("history is the member's own; leavers get 403", async () => {
    const { GET, POST } = await import("@/app/api/ask/route");
    const mine = (await (await GET(req("/api/ask", { token: token.december }))).json()) as { messages: { content: string }[] };
    assert.ok(mine.messages.length >= 2);
    const theirs = ok(await client.december.from("chat_messages").select("user_id"), "chat") as { user_id: string }[];
    assert.ok(theirs.every((m) => m.user_id === member.december.id));
    assert.equal((await POST(askReq("leaver", { question: "x" }))).status, 403);
    assert.equal((await POST(askReq("nodate", { question: "x" }))).status, 403);
  });
});

// ── MCP (per-member token) ───────────────────────────────
const rpc = async (k: PersonaKey | null, method: string, params?: Record<string, unknown>) => {
  const { POST } = await import("@/app/api/mcp/route");
  const r = await POST(req("/api/mcp", { method: "POST", token: k ? token[k] : undefined, body: { jsonrpc: "2.0", id: 1, method, params } }));
  return { status: r.status, headers: r.headers, body: (r.status === 202 ? null : await r.json()) as { result?: Record<string, unknown>; error?: { message: string } } | null };
};
const toolJson = (b: { result?: Record<string, unknown> } | null) => (b?.result?.structuredContent ?? {}) as Record<string, unknown>;

describe("MCP", () => {
  it("no token: 401 pointing at the OAuth metadata", async () => {
    const r = await rpc(null, "initialize");
    assert.equal(r.status, 401);
    assert.match(r.headers.get("www-authenticate") ?? "", /resource_metadata=".*\/\.well-known\/oauth-protected-resource\/api\/mcp"/);
    const { GET } = await import("@/app/api/mcp/oauth-protected-resource/route");
    const meta = (await (await GET(req("/.well-known/oauth-protected-resource/api/mcp"))).json()) as { authorization_servers: string[] };
    assert.ok(meta.authorization_servers[0].endsWith("/auth/v1"));
  });

  it("leavers and undated members: 403", async () => {
    assert.equal((await rpc("leaver", "tools/list")).status, 403);
    assert.equal((await rpc("nodate", "tools/list")).status, 403);
  });

  for (const k of ["founding", "noah", "december", "january"] as const) {
    it(`${k}: list_meetings, get_agenda, search_agendas, my_contest`, async () => {
      const init = await rpc(k, "initialize", { protocolVersion: "2025-06-18" });
      assert.equal(init.body?.result?.protocolVersion, "2025-06-18");
      const tools = (await rpc(k, "tools/list")).body?.result?.tools as { name: string }[];
      const { TOOLS } = await import("@/lib/mcp");
      assert.deepEqual(tools.map((t) => t.name).sort(), TOOLS.map((t) => t.name).sort());

      const list = toolJson((await rpc(k, "tools/call", { name: "list_meetings", arguments: {} })).body).meetings as { id: string }[];
      assert.deepEqual(sorted(list.filter((m) => keyOfMeeting(m.id) !== m.id).map((m) => keyOfMeeting(m.id))), visibleMeetings(k));

      for (const m of MEETINGS) {
        const got = (await rpc(k, "tools/call", { name: "get_agenda", arguments: { meeting_id: meetingId[m.key] } })).body?.result;
        assert.equal(!got?.isError, seesDate(k, m.held_on), `${k} get_agenda ${m.key}`);
      }
      const missing = (await rpc(k, "tools/call", { name: "get_agenda", arguments: { meeting_id: "00000000-0000-0000-0000-000000000000" } })).body?.result;
      const feb = (await rpc(k, "tools/call", { name: "get_agenda", arguments: { meeting_id: meetingId.feb } })).body?.result;
      if (!seesDate(k, "2026-02-05")) assert.deepEqual(feb, missing, "an unseen meeting looks the same as no meeting");

      const found = toolJson((await rpc(k, "tools/call", { name: "search_agendas", arguments: { query: "Lisbon trip?", limit: 10 } })).body)
        .results as { meeting_id: string }[];
      assert.deepEqual(sorted([...new Set(found.map((h) => keyOfMeeting(h.meeting_id)))]), visibleMeetings(k));

      const contest = toolJson((await rpc(k, "tools/call", { name: "my_contest", arguments: {} })).body);
      assert.equal(contest.race != null, seesSeason(k, q4), `${k} race`);
      assert.deepEqual(sorted((contest.seasons as { id: string }[]).map((s) => s.id)), sorted(seasons.filter((s) => seesSeason(k, s)).map((s) => s.id)));
    });
  }
});

const call = async (k: PersonaKey, name: string, args: Record<string, unknown> = {}) => {
  const r = (await rpc(k, "tools/call", { name, arguments: args })).body?.result as { isError?: boolean; structuredContent?: Record<string, unknown>; content: { text: string }[] };
  return { error: !!r?.isError, json: (r?.structuredContent ?? {}) as Record<string, unknown>, text: JSON.stringify(r) };
};

describe("MCP: join-date rule on every tool", () => {
  it("the Parking Lot never shows topics from before a member's first forum", async () => {
    const founding = await call("founding", "get_agenda", { meeting_id: meetingId.aug });
    assert.match(founding.text, /parkfebword/);
    const noah = await call("noah", "get_agenda", { meeting_id: meetingId.aug });
    assert.doesNotMatch(noah.text, /parkfebword/, "get_agenda");
    assert.match(noah.text, /parkaugword/);
    assert.doesNotMatch((await call("noah", "get_parking_lot")).text, /parkfebword/, "get_parking_lot");
    assert.match((await call("noah", "get_parking_lot")).text, /parkaugword/);
    assert.match((await call("founding", "get_parking_lot")).text, /parkfebword/);
    assert.doesNotMatch((await call("noah", "search_agendas", { query: "parkfebword" })).text, /parkfebword/, "search_agendas");
    assert.match((await call("founding", "search_agendas", { query: "parkfebword" })).text, /parkfebword/);
  });

  it("Ask gets no pre-join Parking Lot excerpt either", async () => {
    const { searchAgendas, readerOf } = await import("@/lib/ask");
    const noah = await searchAgendas(client.noah, "parkfebword", { reader: await readerOf(client.noah, member.noah.id) });
    assert.equal(noah.length, 0);
    const f = await searchAgendas(client.founding, "parkfebword", { reader: await readerOf(client.founding, member.founding.id) });
    assert.equal(f.length, 1);
  });

  // Constitution v2: the kitty is open in full to every active member
  it("kitty: every member sees the same balance and every line", async () => {
    const f = (await call("founding", "get_kitty")).json;
    const n = (await call("noah", "get_kitty")).json;
    assert.equal(f.balance_amount, n.balance_amount);
    for (const x of [f, n, (await call("december", "get_kitty")).json]) {
      assert.match(JSON.stringify(x.entries), /kittyfeb/);
      assert.match(JSON.stringify(x.entries), /kittyaug/);
    }
  });

  it("kitty: a member submits an expense, cannot backdate before joining, can void", async () => {
    assert.ok((await call("noah", "add_kitty_entry", { direction: "out", amount: "750k" })).error, "money out needs a note");
    const saved = await call("noah", "add_kitty_entry", { direction: "out", amount: "750k", category: "after_forum", note: "flowers for the venue" });
    assert.equal(saved.error, false, saved.text);
    const line = saved.json.saved as { id: string; amount_vnd: number; category: string };
    assert.equal(Number(line.amount_vnd), 750_000);
    assert.equal(line.category, "after_forum");
    assert.ok((await call("noah", "add_kitty_entry", { direction: "in", amount: "2.5M", entry_on: "2026-02-05" })).error, "before first forum");
    assert.ok((await call("december", "add_kitty_entry", { direction: "in", amount: "2.5M" })).error, "not yet a forum member today");
    assert.equal((await call("noah", "void_kitty_entry", { id: line.id })).error, false);
    assert.ok((await call("noah", "void_kitty_entry", { id: line.id })).error, "a void cannot be repeated");
  });

  it("chat: post and read, nothing from before the first forum", async () => {
    const posted = await call("noah", "post_chat_message", { text: "mcp hello forum" });
    assert.equal(posted.error, false, posted.text);
    const noah = await call("noah", "read_chat", { limit: 200 });
    assert.match(noah.text, /mcp hello forum/);
    assert.match((await call("founding", "read_chat", { limit: 200 })).text, /mcp hello forum/);
    assert.ok((await call("december", "post_chat_message", { text: "too early" })).error);
  });

  it("personal goals: add, update, delete only your own", async () => {
    const added = await call("noah", "add_personal_goal", { title: "mcp goal", target_value: 10 });
    assert.equal(added.error, false, added.text);
    const id = (added.json.added as { id: string }).id;
    assert.equal((await call("noah", "update_personal_goal", { id, current_value: 4 })).error, false);
    assert.ok((await call("founding", "update_personal_goal", { id, current_value: 9 })).error, "not someone else's");
    assert.ok((await call("founding", "delete_personal_goal", { id })).error, "not someone else's");
    assert.equal((await call("noah", "delete_personal_goal", { id })).error, false);
  });

  it("library, members, biometrics and photos follow the same rule", async () => {
    assert.doesNotMatch((await call("noah", "list_library")).text, /leak-expense/, "founding-only doc");
    assert.match((await call("founding", "list_library")).text, /leak-expense/);
    assert.ok((await call("noah", "get_library_doc", { slug: "leak-expense" })).error);
    const bio = (await call("noah", "my_biometrics", { days: 180 })).json.days as { day: string }[];
    assert.ok(bio.every((d) => d.day >= "2026-07-28"));
    assert.equal((await call("noah", "whoami")).json.full_name, "Leak Noah Turner");
    assert.doesNotMatch((await call("noah", "list_members")).text, /Leak Leaver/, "leavers are not listed");
  });
});

describe("MCP: forum planning", () => {
  it("get_forum_plan and get_rotation follow the join-date rule", async () => {
    for (const k of ["founding", "noah", "december", "january"] as const) {
      for (const m of MEETINGS) {
        const plan = await call(k, "get_forum_plan", { date: m.held_on });
        assert.equal(!plan.error, seesDate(k, m.held_on), `${k} get_forum_plan ${m.key}`);
        if (!plan.error) assert.match(plan.text, new RegExp(`agendaword${m.key}`));
      }
      const rot = (await call(k, "get_rotation", { from: "2026-01-01", to: "2027-12-31" })).json.forums as { date: string }[];
      assert.deepEqual(sorted(rot.map((f) => MEETINGS.find((m) => m.held_on === f.date)?.key ?? f.date)), visibleMeetings(k));    }
    const feb = await call("noah", "get_forum_plan", { date: "2026-02-05" });
    const none = await call("noah", "get_forum_plan", { date: "2026-02-06" });
    assert.equal(feb.text, none.text, "an unseen forum looks the same as no forum");
  });

  it("get_forum_plan counts members present and times the standard run sheet", async () => {
    const dec = (await call("founding", "get_forum_plan", { date: "2026-12-23" })).json;
    // founding, noah, december (joins that day); not january, not the leaver (left in November), not nodate
    assert.equal(dec.members_present, 3);
    const std = dec.standard_run_sheet as { starts_at: string; minutes: number; kind: string }[];
    assert.deepEqual(std.slice(0, 5).map((l) => [l.starts_at, l.kind, l.minutes]), [
      ["13:45", "arrival", 15], ["14:00", "welcome", 10], ["14:10", "starters", 10], ["14:20", "merps", 5], ["14:25", "updates", 15],
    ]);
  });

  it("only admins write; every write shows before and after", async () => {
    for (const k of ["noah", "december"] as const) {
      assert.ok((await call(k, "update_forum", { date: "2026-12-23", theme: "hacked" })).error, `${k} update_forum`);
      assert.ok((await call(k, "set_agenda", { date: "2026-12-23", items: [] })).error, `${k} set_agenda`);
      assert.ok((await call(k, "set_presentation", { date: "2026-12-23", presenter: "Noah" })).error, `${k} set_presentation`);
      assert.ok((await call(k, "set_planners", { date: "2026-12-23", members: [] })).error, `${k} set_planners`);
      assert.ok((await call(k, "set_role", { year: 2027, role: "treasurer", member: "Noah" })).error, `${k} set_role`);
    }
    const theme = await call("founding", "update_forum", { date: "2026-12-23", theme: "Welcome Mia Archer", host: "Mia Archer", starts_at: "14:00", conversation_starters: ["One?", "Two?"] });
    assert.equal(theme.error, false, theme.text);
    assert.equal((theme.json.before as { theme: string }).theme, "theme dec");
    assert.equal((theme.json.after as { theme: string; host: string }).theme, "Welcome Mia Archer");
    assert.equal((theme.json.after as { host: string }).host, "Leak Mia Archer");
    assert.equal((theme.json.after as { starts_at: string }).starts_at, "2:00 pm", "start time is GMT+7");

    const agenda = await call("founding", "set_agenda", {
      date: "2026-12-23",
      items: [
        { kind: "arrival", title: "Arrival", starts_at: "13:45", minutes: 15 },
        { kind: "lifeline", title: "Mia Archer's lifeline", minutes: 20, owner: "Mia Archer" },
      ],
    });
    assert.equal(agenda.error, false, agenda.text);
    assert.equal((agenda.json.before as unknown[]).length, 1);
    assert.deepEqual((agenda.json.after as { title: string; owner: string | null }[]).map((i) => [i.title, i.owner]), [["Arrival", null], ["Mia Archer's lifeline", "Leak Mia Archer"]]);
    assert.ok((await call("founding", "set_agenda", { date: "2026-12-23", items: [{ kind: "nope", title: "x" }] })).error, "bad kind");
    const kept = (await call("founding", "get_forum_plan", { date: "2026-12-23" })).json.run_sheet as unknown[];
    assert.equal(kept.length, 2, "a refused set_agenda keeps the old run sheet");

    assert.ok((await call("founding", "set_presentation", { date: "2026-12-23", presenter: "Noah", coach: "Noah" })).error, "no self-coaching");
    const pres = await call("founding", "set_presentation", { date: "2026-12-23", presenter: "Noah", coach: "Mia Archer" });
    assert.equal(pres.error, false, pres.text);
    assert.match(JSON.stringify(pres.json.after), /Leak Noah Turner.*Leak Mia Archer/);
    assert.equal((await call("founding", "remove_presentation", { date: "2026-12-23", presenter: "Noah" })).error, false);

    const planners = await call("founding", "set_planners", { date: "2026-12-23", members: ["Noah", "Mia Archer"] });
    assert.deepEqual(sorted((planners.json.after as string[]) ?? []), ["Leak Mia Archer", "Leak Noah Turner"]);
    assert.deepEqual(((await call("founding", "set_planners", { date: "2026-12-23", members: ["Founding"] })).json.after as string[]), ["Leak Founding"]);

    const role = await call("founding", "set_role", { year: 2027, role: "treasurer", member: "Noah" });
    assert.deepEqual((role.json.roles as Record<string, string[]>).treasurer, ["Leak Noah Turner"]);
    assert.deepEqual(((await call("noah", "get_roles", { year: 2027 })).json.roles as Record<string, string[]>).moderator, ["Leak Founding"]);
    const gone = await call("founding", "set_role", { year: 2027, role: "treasurer", member: "Noah", remove: true });
    assert.deepEqual((gone.json.roles as Record<string, string[]>).treasurer, []);
  });

  it("the planning guide and the plan_forum prompt", async () => {
    assert.match((await call("noah", "planning_guide")).text, /MERPS/);
    const list = (await rpc("noah", "prompts/list")).body?.result?.prompts as { name: string }[];
    assert.deepEqual(list.map((p) => p.name), ["plan_forum"]);
    const got = (await rpc("noah", "prompts/get", { name: "plan_forum", arguments: { date: "2026-12-23" } })).body?.result as { messages: { content: { text: string } }[] };
    assert.match(got.messages[0].content.text, /Plan the forum on 2026-12-23/);
    assert.ok((await rpc("noah", "prompts/get", { name: "nope" })).body?.error);
  });
});

// ── Push and the app build gate ──────────────────────────
describe("push", () => {
  const devices = async () => import("@/app/api/push/devices/route");

  it("register: active members only, valid Expo tokens only", async () => {
    const { POST } = await devices();
    const body = { expo_token: "ExponentPushToken[leak-noah-2]", platform: "ios", app_version: "1.0" };
    assert.equal((await POST(req("/api/push/devices", { method: "POST", token: token.noah, body }))).status, 200);
    assert.equal((await POST(req("/api/push/devices", { method: "POST", token: token.noah, body: { expo_token: "nope", platform: "ios" } }))).status, 400);
    assert.equal((await POST(req("/api/push/devices", { method: "POST", token: token.leaver, body }))).status, 403);
  });

  it("a shared phone's token moves to the member now signed in", async () => {
    const { POST } = await devices();
    const body = { expo_token: "ExponentPushToken[leak-shared]", platform: "ios" };
    await POST(req("/api/push/devices", { method: "POST", token: token.noah, body }));
    await POST(req("/api/push/devices", { method: "POST", token: token.december, body }));
    const row = ok(await admin.from("push_devices").select("user_id").eq("expo_token", body.expo_token).single(), "shared") as { user_id: string };
    assert.equal(row.user_id, member.december.id);
  });

  it("a meeting push reaches only members who can see that date, with generic text", async () => {
    const { pushToAll, render } = await import("@/lib/push");
    process.env.EXPO_ACCESS_TOKEN = "leak-expo";
    ok(await admin.from("push_devices").insert({ user_id: member.founding.id, platform: "ios", expo_token: "ExponentPushToken[leak-dead]" }), "dead");
    expoBodies.length = 0;
    const res = await pushToAll(admin, { kind: "new_agenda", heldOn: "2026-08-24" });
    const to = expoBodies.flat().map((m) => m.to);
    const owners = ok(await admin.from("push_devices").select("user_id, expo_token").in("expo_token", to), "owners") as { user_id: string }[];
    const keys = [...new Set(owners.map((o) => KEYS.find((x) => member[x].id === o.user_id)))].sort();
    assert.deepEqual(keys, ["founding", "noah"]);
    for (const m of expoBodies.flat()) assert.equal(m.body, render({ kind: "new_agenda", heldOn: "" }, DEFAULT_FORUM_SETTINGS).body);
    assert.ok("revoked" in res && res.revoked === 1, "unregistered device revoked");
    const dead = ok(await admin.from("push_devices").select("revoked_at").eq("expo_token", "ExponentPushToken[leak-dead]").single(), "dead") as { revoked_at: string | null };
    assert.ok(dead.revoked_at);
    delete process.env.EXPO_ACCESS_TOKEN;
  });

  it("every template's text is free of private content", async () => {
    const { render } = await import("@/lib/push");
    const texts = [
      render({ kind: "next_forum", heldOn: "2026-12-23", startsAt: "2026-12-23T11:00:00Z" }, DEFAULT_FORUM_SETTINGS),
      render({ kind: "new_agenda", heldOn: "2026-12-23" }, DEFAULT_FORUM_SETTINGS),
      render({ kind: "whip_nudge" }, DEFAULT_FORUM_SETTINGS),
      render({ kind: "report_ready", month: "2026-12" }, DEFAULT_FORUM_SETTINGS),
    ];
    assert.equal(texts[0].body, "Next forum: Wed 23 Dec, 6 pm");
    assert.equal(texts[0].data.path, "/forum/2026-12-23");
    assert.equal(texts[3].body, "The December 2026 report is ready");
    assert.equal(texts[3].data.path, "/contest/report/2026-12");
    for (const t of texts) assert.doesNotMatch(`${t.title} ${t.body}`, /agenda text|secret|score|goal/i);
  });

  it("MOBILE_MIN_BUILD: older or unlabelled app builds get 426; the config endpoint reports it", async () => {
    const goal = await import("@/app/api/goal/route");
    const cfg = await import("@/app/api/mobile/config/route");
    process.env.MOBILE_MIN_BUILD = "5";
    const patch = (headers: Record<string, string>) =>
      goal.PATCH(
        new NextRequest("http://localhost/api/goal", {
          method: "PATCH",
          headers: { "content-type": "application/json", authorization: `Bearer ${token.noah}`, ...headers },
          body: JSON.stringify({ currentValue: 4, targetValue: 10, status: "on_track" }),
        })
      );
    assert.equal((await patch({})).status, 426);
    assert.equal((await patch({ "x-app-build": "4" })).status, 426);
    assert.equal((await patch({ "x-app-build": "5" })).status, 200);
    assert.equal(((await (await cfg.GET()).json()) as { min_build: number }).min_build, 5);
    delete process.env.MOBILE_MIN_BUILD;
  });
});

// ── Admin: preview as member, members API, last visit ────
describe("admin", () => {
  it("admin_preview shows what a member would see, from the real rule; admins only", async () => {
    const { data, error } = await client.founding.rpc("admin_preview", { member: member.december.id });
    assert.equal(error, null);
    const p = data as { active: boolean; meetings: { id: string }[]; library: string[]; seasons: string[] };
    assert.equal(p.active, true);
    assert.deepEqual(sorted(p.meetings.map((m) => keyOfMeeting(m.id)).filter((k) => MEETINGS.some((m) => m.key === k))), visibleMeetings("december"));
    assert.deepEqual(p.library.filter((s) => s.startsWith("leak-")), ["leak-constitution"]);
    assert.deepEqual(sorted(p.seasons), sorted(seasons.filter((s) => seesSeason("december", s)).map((s) => s.id)));
    assert.ok(p.seasons.includes(q1.id) && !p.seasons.includes(q4.id), "Q1, not Q4");
    const leaver = (await client.founding.rpc("admin_preview", { member: member.leaver.id })).data as { meetings: unknown[]; library: unknown[]; seasons: unknown[] };
    assert.deepEqual([leaver.meetings.length, leaver.library.length, leaver.seasons.length], [0, 0, 0]);
    assert.ok((await client.noah.rpc("admin_preview", { member: member.founding.id })).error, "non-admin denied");
  });

  it("touch_last_seen stamps only the caller; the column is not directly writable", async () => {
    await client.noah.rpc("touch_last_seen");
    const second = await client.noah.rpc("touch_last_seen");
    assert.ok(second.data, "returns the previous visit");
    const direct = await client.noah.from("profiles").update({ last_seen_at: "2020-01-01T00:00:00Z" }).eq("id", member.noah.id);
    assert.ok(direct.error);
  });

  it("members API: admins only; invite with no date sees nothing", async () => {
    const api = await import("@/app/api/admin/members/route");
    assert.equal((await api.GET(req("/api/admin/members", { token: token.noah }))).status, 403);
    const list = (await (await api.GET(req("/api/admin/members", { token: token.founding }))).json()) as { members: { id: string; status: string }[] };
    const status = (k: PersonaKey) => list.members.find((m) => m.id === member[k].id)?.status;
    assert.equal(status("leaver"), "left");
    assert.equal(status("noah"), "active");
    assert.equal(status("nodate"), "no_date");

    const inv = await api.POST(req("/api/admin/members", { method: "POST", token: token.founding, body: { email: "leak-invite@leak.test", full_name: "Leak Invite" } }));
    assert.equal(inv.status, 200, JSON.stringify(await inv.clone().json()));
    const { id } = (await inv.json()) as { id: string };
    const ok2 = await admin.rpc("member_is_active", { uid: id });
    assert.equal(ok2.data, false, "invited without a date: no access");

    const patch = await api.PATCH(req("/api/admin/members", { method: "PATCH", token: token.founding, body: { id, forum_joined_on: "2027-01-20" } }));
    assert.equal(patch.status, 200);
    assert.equal((await admin.rpc("member_can_see_date", { uid: id, d: "2026-12-23" })).data, false);
    assert.equal((await admin.rpc("member_can_see_date", { uid: id, d: "2027-01-20" })).data, true);

    const del = await api.DELETE(req("/api/admin/members", { method: "DELETE", token: token.founding, body: { id } }));
    assert.equal(del.status, 200);
    assert.equal((await admin.rpc("member_is_active", { uid: id })).data, false, "removed today: no access");
  });
});

// ── Forum settings (0033): active members read, admins update, nobody inserts or deletes ─
describe("forum settings", () => {
  const fs = (c: DB) => (c as unknown as SupabaseClient).from("forum_settings");

  it("active members read the row; leavers, no-date members and anon read nothing", async () => {
    for (const k of ["founding", "noah"] as const) {
      const rows = ok(await fs(client[k]).select("name, currency, time_zone"), `${k} read`) as { name: string }[];
      assert.equal(rows.length, 1, `${k} sees the row`);
    }
    for (const k of ["leaver", "nodate"] as const) {
      const rows = ok(await fs(client[k]).select("name"), `${k} read`) as unknown[];
      assert.equal(rows.length, 0, `${k} sees nothing`);
    }
    const anon = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
    const r = await anon.from("forum_settings").select("name");
    assert.ok(r.error || (r.data ?? []).length === 0, "anon sees nothing");
  });

  it("only an admin updates; no client inserts or deletes; the time zone must exist", async () => {
    const before = ok(await fs(admin).select("short_name, dues_per_forum").single(), "before") as { short_name: string; dues_per_forum: number };
    const denied = await fs(client.noah).update({ short_name: "Hijacked" }).eq("id", true).select("id");
    assert.equal((denied.data ?? []).length, 0, "non-admin changes nothing");

    const saved = ok(await fs(client.founding).update({ short_name: "Leak Forum", dues_per_forum: 3_000_000 }).eq("id", true).select("short_name"), "admin update") as { short_name: string }[];
    assert.deepEqual(saved.map((x) => x.short_name), ["Leak Forum"]);
    const dues = ok(await (admin as unknown as SupabaseClient).from("kitty_settings").select("dues_vnd").single(), "dues") as { dues_vnd: number };
    assert.equal(Number(dues.dues_vnd), 3_000_000, "dues kept in step for the iPhone app");

    assert.ok((await fs(client.founding).update({ time_zone: "Mars/Olympus" }).eq("id", true)).error, "unknown time zone");
    assert.ok((await fs(client.founding).insert({ id: true, name: "x", short_name: "x", site_url: "https://x.test" })).error, "no insert");
    await fs(client.founding).delete().eq("id", true);
    assert.equal((ok(await fs(admin).select("id"), "still there") as unknown[]).length, 1, "no delete");

    ok(await fs(admin).update({ short_name: before.short_name, dues_per_forum: before.dues_per_forum }).eq("id", true), "restore");
  });

  it("forum_today() is today in the forum's time zone", async () => {
    const tz = (ok(await fs(admin).select("time_zone").single(), "tz") as { time_zone: string }).time_zone;
    const { data } = await client.noah.rpc("forum_today" as never);
    assert.equal(data, new Date().toLocaleDateString("en-CA", { timeZone: tz }));
  });
});

// ── WHOOP connect started from the iPhone app (no cookie) ─
describe("WHOOP app flow", () => {
  it("a stored state ends on the app scheme, works once, and unknown states fail on the web /me", async () => {
    const { GET } = await import("@/app/api/whoop/callback/route");
    const saved = process.env.MOBILE_APP_SCHEME;
    process.env.MOBILE_APP_SCHEME = "leakapp";
    ok(await admin.from("whoop_oauth_states").insert({ state: "LeakAbc1", user_id: member.noah.id }), "state");
    const first = await GET(req("/api/whoop/callback?state=LeakAbc1&error=access_denied"));
    assert.equal(first.headers.get("location"), "leakapp://me?whoop=denied");
    const replay = await GET(req("/api/whoop/callback?state=LeakAbc1&error=access_denied"));
    assert.match(replay.headers.get("location") ?? "", /^http:\/\/localhost\/me\?whoop=error$/);
    const rows = ok(await admin.from("whoop_oauth_states").select("state").eq("state", "LeakAbc1"), "gone") as unknown[];
    assert.equal(rows.length, 0, "state consumed");
    const read = await client.noah.from("whoop_oauth_states").select("state");
    assert.ok(read.error, "members have no access to the states table at all");

    // no MOBILE_APP_SCHEME: an app flow ends on the web /me instead
    delete process.env.MOBILE_APP_SCHEME;
    ok(await admin.from("whoop_oauth_states").insert({ state: "LeakAbc2", user_id: member.noah.id }), "state 2");
    const web = await GET(req("/api/whoop/callback?state=LeakAbc2&error=access_denied"));
    assert.match(web.headers.get("location") ?? "", /^http:\/\/localhost\/me\?whoop=denied$/);
    const rows2 = ok(await admin.from("whoop_oauth_states").select("state").eq("state", "LeakAbc2"), "gone 2") as unknown[];
    assert.equal(rows2.length, 0, "state consumed");
    if (saved === undefined) delete process.env.MOBILE_APP_SCHEME;
    else process.env.MOBILE_APP_SCHEME = saved;
  });
});

// ── Gallery ──────────────────────────────────────────────
describe("gallery", () => {
  const img = (type = "image/webp") => new Blob([new Uint8Array([1, 2, 3, 4])], { type });
  const photo = (id: string, taken_on: string, uploaded_by: string, extra: Record<string, unknown> = {}) => ({
    id,
    uploaded_by,
    taken_on,
    original_path: `${id}/original.jpg`,
    web_path: `${id}/web.webp`,
    thumb_path: `${id}/thumb.webp`,
    ...extra,
  });
  const SEED = [
    { key: "feb", taken_on: "2026-02-05" },
    { key: "aug", taken_on: "2026-08-24" },
    { key: "dec", taken_on: "2026-12-24" },
    { key: "jan", taken_on: "2027-01-25" },
  ];
  const pid: Record<string, string> = {};

  before(async () => {
    for (const s of SEED) {
      const id = crypto.randomUUID();
      pid[s.key] = id;
      ok(await admin.from("gallery_photos").insert(photo(id, s.taken_on, member.founding.id)), `photo ${s.key}`);
      const store = admin.storage.from("gallery");
      ok(await store.upload(`${id}/original.jpg`, img("image/jpeg")), "orig");
      ok(await store.upload(`${id}/web.webp`, img()), "web");
      ok(await store.upload(`${id}/thumb.webp`, img()), "thumb");
    }
  });

  for (const k of KEYS) {
    // Constitution v2: photos are open in full to every active member; leavers and members without a date see none
    it(`${k}: sees every photo and file if active, none otherwise`, async () => {
      const rows = ok(await client[k].from("gallery_photos").select("id"), "rows") as { id: string }[];
      const seen = rows.map((r) => r.id).filter((id) => Object.values(pid).includes(id));
      assert.deepEqual(sorted(seen), active(k) ? sorted(Object.values(pid)) : []);
      for (const s of SEED) {
        const dl = await client[k].storage.from("gallery").download(`${pid[s.key]}/thumb.webp`);
        assert.equal(!dl.error && !!dl.data, active(k), `${k} thumb ${s.key}`);
        const url = await client[k].storage.from("gallery").createSignedUrl(`${pid[s.key]}/web.webp`, 60);
        assert.equal(!url.error && !!url.data, active(k), `${k} signed url ${s.key}`);
      }
    });
  }

  it("a member posts only inside their own time, only their own three files", async () => {
    const c = client.december;
    const mine = crypto.randomUUID();
    assert.equal((await c.from("gallery_photos").insert(photo(mine, "2026-12-24", member.december.id))).error, null, "own date ok");
    const st = c.storage.from("gallery");
    assert.equal((await st.upload(`${mine}/thumb.webp`, img())).error, null, "own thumb ok");
    assert.ok((await st.upload(`${mine}/thumb.webp`, img(), { upsert: true })).error, "no overwrite");
    assert.ok((await st.upload(`${mine}/evil.webp`, img())).error, "only the three names");
    assert.ok((await st.upload(`${pid.dec}/extra.webp`, img())).error, "not into another photo's folder");
    assert.ok((await st.upload(`${crypto.randomUUID()}/thumb.webp`, img())).error, "not without a row");

    const past = crypto.randomUUID();
    assert.ok((await c.from("gallery_photos").insert(photo(past, "2026-02-05", member.december.id))).error, "no posting into the past");
    const asOther = crypto.randomUUID();
    assert.ok((await c.from("gallery_photos").insert(photo(asOther, "2026-12-24", member.noah.id))).error, "not as someone else");
    const badPath = crypto.randomUUID();
    assert.ok(
      (await c.from("gallery_photos").insert({ ...photo(badPath, "2026-12-24", member.december.id), web_path: `${pid.feb}/web.webp` })).error,
      "paths must be the row's own"
    );
    const hidden = crypto.randomUUID();
    assert.ok(
      (await client.noah.from("gallery_photos").insert(photo(hidden, "2026-12-24", member.noah.id, { meeting_id: meetingId.feb }))).error,
      "cannot link a meeting you can't see"
    );
    for (const k of ["leaver", "nodate"] as const) {
      const id = crypto.randomUUID();
      assert.ok((await client[k].from("gallery_photos").insert(photo(id, "2026-12-24", member[k].id))).error, `${k} cannot post`);
    }
  });

  it("edits: uploader or admin, caption/date/meeting only, never into the past", async () => {
    const own = crypto.randomUUID();
    ok(await client.noah.from("gallery_photos").insert(photo(own, "2026-08-25", member.noah.id)), "noah photo");
    const cap = await client.noah.from("gallery_photos").update({ caption: "hello" }).eq("id", own).select("id");
    assert.equal(cap.data?.length, 1, "uploader edits caption");
    assert.ok((await client.noah.from("gallery_photos").update({ uploaded_by: member.founding.id }).eq("id", own)).error, "uploaded_by locked");
    assert.ok((await client.noah.from("gallery_photos").update({ original_path: `${own}/original.png` }).eq("id", own)).error, "paths locked");
    assert.ok((await client.noah.from("gallery_photos").update({ taken_on: "2026-02-05" }).eq("id", own)).error, "no moving into the past");
    const other = await client.noah.from("gallery_photos").update({ caption: "x" }).eq("id", pid.aug).select("id");
    assert.equal(other.data?.length ?? 0, 0, "not someone else's photo");
    const byAdmin = await client.founding.from("gallery_photos").update({ caption: "admin" }).eq("id", own).select("id");
    assert.equal(byAdmin.data?.length, 1, "admin edits any");
  });

  it("deletes: uploader or admin, files too", async () => {
    const id = crypto.randomUUID();
    ok(await client.noah.from("gallery_photos").insert(photo(id, "2026-08-26", member.noah.id)), "noah photo");
    assert.equal((await client.noah.storage.from("gallery").upload(`${id}/web.webp`, img())).error, null);
    const dec = await client.december.from("gallery_photos").delete().eq("id", pid.dec).select("id");
    assert.equal(dec.data?.length ?? 0, 0, "december cannot delete founding's photo");
    const notMine = await client.december.storage.from("gallery").remove([`${id}/web.webp`]);
    assert.equal((notMine.data ?? []).length, 0, "nor noah's files");
    const files = await client.noah.storage.from("gallery").remove([`${id}/web.webp`]);
    assert.equal((files.data ?? []).length, 1, "uploader removes own file");
    const row = await client.noah.from("gallery_photos").delete().eq("id", id).select("id");
    assert.equal(row.data?.length, 1, "uploader removes own row");
    const byAdmin = await client.founding.from("gallery_photos").delete().eq("id", pid.jan).select("id");
    assert.equal(byAdmin.data?.length, 1, "admin removes any row");
  });

  it("cleanup removes rows without files and files without rows, after the grace period", async () => {
    const { cleanupGallery } = await import("@/lib/gallery");
    const noFiles = crypto.randomUUID();
    ok(await admin.from("gallery_photos").insert(photo(noFiles, "2026-12-24", member.december.id)), "row without files");
    const orphan = crypto.randomUUID();
    ok(await admin.storage.from("gallery").upload(`${orphan}/thumb.webp`, img()), "orphan file");

    const early = await cleanupGallery(admin);
    assert.deepEqual(early, { rowsRemoved: 0, filesRemoved: 0 }, "nothing inside the grace period");

    const later = await cleanupGallery(admin, Date.now() + 2 * 60 * 60 * 1000);
    assert.ok(later.rowsRemoved >= 1 && later.filesRemoved >= 1, JSON.stringify(later));
    const left = ok(await admin.from("gallery_photos").select("id").in("id", [noFiles, pid.feb, pid.aug, pid.dec]), "left") as { id: string }[];
    assert.deepEqual(sorted(left.map((r) => r.id)), sorted([pid.feb, pid.aug, pid.dec]), "complete photos stay");
    const gone = await admin.storage.from("gallery").list(orphan);
    assert.equal((gone.data ?? []).length, 0, "orphan files removed");
  });
});

// ── Forum chat ───────────────────────────────────────────
describe("forum chat", () => {
  const SENT = [
    { key: "feb", sent_on: "2026-02-05" },
    { key: "aug", sent_on: "2026-08-24" },
    { key: "dec", sent_on: "2026-12-24" },
    { key: "jan", sent_on: "2027-01-25" },
  ];
  const mid: Record<string, string> = {};
  const todayLocal = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

  before(async () => {
    for (const s of SENT) {
      const row = ok(
        await admin
          .from("forum_messages")
          // Noah Turner wrote the August message; the founding member wrote the rest
          .insert({ author_id: s.key === "aug" ? member.noah.id : member.founding.id, body: `chat ${s.key}`, sent_on: s.sent_on })
          .select("id")
          .single(),
        `msg ${s.key}`
      ) as { id: string };
      mid[s.key] = row.id;
    }
  });

  for (const k of KEYS) {
    // Chat history is open in full to every active member; leavers and members without a date see none
    it(`${k}: reads the whole chat if active, none otherwise`, async () => {
      const rows = ok(await client[k].from("forum_messages").select("id"), "chat") as { id: string }[];
      const seen = rows.map((r) => r.id).filter((id) => Object.values(mid).includes(id));
      assert.deepEqual(sorted(seen), active(k) ? sorted(Object.values(mid)) : []);
    });
  }

  it("posting: active members on a day they can see, as themselves, with their own links", async () => {
    const posted = await client.noah.from("forum_messages").insert({ body: "hello forum" }).select("id, author_id, sent_on").single();
    assert.equal(posted.error, null);
    assert.equal(posted.data?.author_id, member.noah.id);
    assert.equal(posted.data?.sent_on, todayLocal);
    assert.equal(seesDate("december", todayLocal), false);
    assert.ok((await client.december.from("forum_messages").insert({ body: "too early" })).error, "before first forum: cannot post");
    for (const k of ["leaver", "nodate"] as const) assert.ok((await client[k].from("forum_messages").insert({ body: "x" })).error, `${k} cannot post`);
    assert.ok((await client.noah.from("forum_messages").insert({ body: "x", author_id: member.founding.id } as never)).error, "not as someone else");
    assert.ok((await client.noah.from("forum_messages").insert({ body: "x", sent_on: "2026-02-05" } as never)).error, "cannot backdate");
    assert.ok((await client.noah.from("forum_messages").insert({ body: "" })).error, "empty body refused");
    assert.equal((await client.noah.from("forum_messages").insert({ body: "re", reply_to: mid.feb })).error, null, "can reply to a message from before they joined");
    assert.equal((await client.noah.from("forum_messages").insert({ body: "re", reply_to: mid.aug })).error, null, "can reply to a visible one");
  });

  it("edit, soft delete, admin delete", async () => {
    const own = ok(await client.noah.from("forum_messages").insert({ body: "draft" }).select("id").single(), "own") as { id: string };
    const ed = ok(await client.noah.from("forum_messages").update({ body: "edited" }).eq("id", own.id).select("body, edited_at").single(), "edit") as {
      body: string;
      edited_at: string | null;
    };
    assert.equal(ed.body, "edited");
    assert.ok(ed.edited_at, "edited_at stamped");
    const other = await client.noah.from("forum_messages").update({ body: "hijack" }).eq("id", mid.dec).select("id");
    assert.equal(other.data?.length ?? 0, 0, "not someone else's message");
    assert.ok((await client.noah.from("forum_messages").update({ notified_at: null } as never).eq("id", own.id)).error, "server columns locked");

    const del = ok(
      await client.noah.from("forum_messages").update({ deleted_at: new Date().toISOString() }).eq("id", own.id).select("body, deleted_at").single(),
      "soft delete"
    ) as { body: string; deleted_at: string | null };
    assert.equal(del.body, "", "content wiped");
    assert.ok(del.deleted_at);
    const undo = await client.noah.from("forum_messages").update({ deleted_at: null }).eq("id", own.id).select("id");
    assert.ok(undo.error || (undo.data ?? []).length === 0, "cannot undelete");

    const rewrite = await client.founding.from("forum_messages").update({ body: "admin words" }).eq("id", mid.aug).select("id");
    assert.ok(rewrite.error || (rewrite.data ?? []).length === 0, "admin cannot rewrite");
    const byAdmin = ok(
      await client.founding.from("forum_messages").update({ deleted_at: new Date().toISOString() }).eq("id", mid.aug).select("body").single(),
      "admin delete"
    ) as { body: string };
    assert.equal(byAdmin.body, "");
  });

  it("read marks are the member's own", async () => {
    assert.equal((await client.noah.from("forum_read_marks").upsert({ last_read_at: new Date().toISOString() })).error, null);
    assert.ok((await client.noah.from("forum_read_marks").insert({ user_id: member.founding.id })).error, "not for someone else");
    const theirs = ok(await client.founding.from("forum_read_marks").select("user_id"), "marks") as { user_id: string }[];
    assert.ok(theirs.every((r) => r.user_id === member.founding.id));
    assert.ok((await client.leaver.from("forum_read_marks").upsert({ last_read_at: new Date().toISOString() })).error, "leaver cannot");
  });

  it("the table is in the realtime publication", async () => {
    const { data } = await admin.rpc("member_is_active", { uid: member.noah.id }); // keep a round trip on the API
    assert.equal(data, true);
    const pub = await import("node:child_process");
    const out = pub.execSync(
      `docker exec -i $(docker ps --format '{{.Names}}' | grep supabase_db) psql -U postgres -tAc "select count(*) from pg_publication_tables where pubname='supabase_realtime' and tablename='forum_messages'"`
    );
    assert.equal(String(out).trim(), "1");
  });

  it("chat push: generic text, once, only to others who can see that day", async () => {
    const { POST } = await import("@/app/api/forum/notify/route");
    const { render } = await import("@/lib/push");
    process.env.EXPO_ACCESS_TOKEN = "leak-expo";
    ok(await admin.from("forum_messages").update({ notified_at: null }).is("deleted_at", null), "reset notified");
    ok(await admin.from("push_devices").update({ revoked_at: null }).like("expo_token", "ExponentPushToken[leak-%"), "revive devices");
    const m = ok(await client.noah.from("forum_messages").insert({ body: "push me" }).select("id").single(), "msg") as { id: string };
    expoBodies.length = 0;
    const r = await POST(req("/api/forum/notify", { method: "POST", token: token.noah, body: { message_id: m.id } }));
    const body = (await r.json()) as { pushed: boolean };
    assert.equal(body.pushed, true);
    const to = expoBodies.flat().map((x) => x.to);
    const owners = ok(await admin.from("push_devices").select("user_id").in("expo_token", to), "owners") as { user_id: string }[];
    const keys = [...new Set(owners.map((o) => KEYS.find((x) => member[x].id === o.user_id)))].sort();
    assert.deepEqual(keys, KEYS.filter((k) => k !== "noah" && seesDate(k, todayLocal)).sort(), "others who can see today");
    for (const x of expoBodies.flat()) assert.equal(x.body, render({ kind: "forum_message", sentOn: todayLocal }, DEFAULT_FORUM_SETTINGS).body);
    assert.doesNotMatch(JSON.stringify(expoBodies), /push me/, "message text never in the push");
    const again = (await (await POST(req("/api/forum/notify", { method: "POST", token: token.noah, body: { message_id: m.id } }))).json()) as { pushed: boolean };
    assert.equal(again.pushed, false, "once per message");
    const notMine = await POST(req("/api/forum/notify", { method: "POST", token: token.founding, body: { message_id: m.id } }));
    assert.equal(notMine.status, 404, "only the author can trigger it");
    delete process.env.EXPO_ACCESS_TOKEN;
  });
});

// ── Seasons beyond Q4: goals per season, standings per season ─────
describe("seasons", () => {
  it("season_standings: each member sees only seasons they can see; riders joined by the season's first day", async () => {
    for (const k of KEYS) {
      const rows = ok(await client[k].from("season_standings").select("season_id, user_id"), "season_standings") as { season_id: string; user_id: string }[];
      const mine = rows.filter((r) => Object.values(member).some((m) => m.id === r.user_id));
      const seasonsSeen = [...new Set(mine.map((r) => r.season_id))].sort();
      assert.deepEqual(seasonsSeen, sorted(seasons.filter((s) => seesSeason(k, s)).map((s) => s.id)), `${k} seasons`);
      for (const s of seasons.filter((x) => seesSeason(k, x))) {
        const riders = mine.filter((r) => r.season_id === s.id).map((r) => KEYS.find((x) => member[x].id === r.user_id)).sort();
        const expect = KEYS.filter((x) => PERSONAS[x].is_founding || (PERSONAS[x].forum_joined_on !== null && PERSONAS[x].forum_joined_on! <= s.ends_on)).sort();
        assert.deepEqual(riders, expect, `${k} riders of ${s.slug}`);
      }
    }
  });

  it("race_standings is today's season", async () => {
    const rows = ok(await client.founding.from("race_standings").select("season_id"), "race") as { season_id: string }[];
    const { seasonForDay } = await import("@/lib/contest");
    const today = seasonForDay(seasons);
    assert.ok(rows.length > 0 && rows.every((r) => r.season_id === today?.id));
  });

  it("goals: one per member per season; lock in the next season before it starts", async () => {
    const goal = await import("@/app/api/goal/route");
    const post = (k: PersonaKey, body: Record<string, unknown>) => goal.POST(req("/api/goal", { method: "POST", token: token[k], body }));
    // Noah Turner already has a Q4 goal; the default season for a new goal is the newest (Q1 here)
    assert.equal((await post("noah", { title: "Q1 goal" })).status, 200);
    assert.equal((await post("noah", { title: "again" })).status, 409, "one per season");
    const namGoals = ok(await admin.from("goals").select("season_id").eq("user_id", member.noah.id), "noah goals") as { season_id: string }[];
    assert.deepEqual(sorted(namGoals.map((g) => g.season_id)), sorted([q4.id, q1.id]));
    // Mia Archer joins in December: Q1 yes, Q4 no
    assert.equal((await post("december", { title: "Q1 for Mia Archer" })).status, 200);
    assert.equal((await post("december", { title: "Q4?", seasonId: q4.id })).status, 400, "cannot pick a season she can't see");
    assert.ok((await client.december.from("goals").insert({ user_id: member.december.id, title: "direct", season_id: q4.id })).error, "RLS too");
    // updates default to today's season
    const patch = await goal.PATCH(req("/api/goal", { method: "PATCH", token: token.noah, body: { currentValue: 7, targetValue: 10, status: "on_track" } }));
    assert.equal(patch.status, 200);
    const q4goal = ok(await admin.from("goals").select("current_value").eq("user_id", member.noah.id).eq("season_id", q4.id).single(), "q4") as { current_value: number };
    assert.equal(Number(q4goal.current_value), 7);
  });

  it("season helpers", async () => {
    const c = await import("@/lib/contest");
    const s = { starts_on: "2027-01-13", ends_on: "2027-03-31", ladder: [0, 1, 2] };
    assert.equal(c.seasonLength(s), 78);
    assert.equal(c.dayOfSeason(s, new Date("2027-01-13T05:00:00Z")), 1);
    assert.equal(c.seasonPhase(s, new Date("2026-12-24T00:00:00Z")), "upcoming");
    assert.equal(c.seasonPenalty(s, 7), 2);
    assert.deepEqual(c.seasonLadder({ ladder: null }), []);
    assert.equal(c.hasContest({ scoring: null }), false, "no scoring picked: no contest");
    assert.equal(c.hasContest({ scoring: "goals" }), true);
    assert.equal(c.seasonPenalty({ ladder: null }, 2), 0, "no contest, no penalty");
    assert.equal(c.newestSeason([{ starts_on: "2026-09-23" }, { starts_on: "2027-01-13" }])?.starts_on, "2027-01-13");
  });

  it("Bookkeeper books only seasons that have ended", async () => {
    const { runBookkeeper } = await import("@/lib/agents");
    const r = await runBookkeeper(admin);
    const { seasonPhase } = await import("@/lib/contest");
    const { hasContest } = await import("@/lib/contest");
    const full = ok(await admin.from("seasons").select("id, starts_on, ends_on, ladder, scoring"), "full") as { starts_on: string; ends_on: string; ladder: unknown; scoring: string | null }[];
    assert.equal(r.seasons.length, full.filter((s) => seasonPhase(s) === "over" && hasContest(s)).length);
  });
});

describe("personal goals per season", () => {
  it("any number per season, only into current or coming seasons the member can see", async () => {
    const add = (k: PersonaKey, season_id: string | null, title: string) =>
      client[k].from("personal_goals").insert({ user_id: member[k].id, title, season_id: season_id as string });
    assert.equal((await add("noah", q1.id, "Q1 one")).error, null);
    assert.equal((await add("noah", q1.id, "Q1 two")).error, null, "more than one per season");
    assert.equal((await add("noah", q4.id, "Q4 extra")).error, null, "Q4 is still running");
    assert.ok((await add("noah", null, "no season")).error, "season required");
    assert.equal((await add("december", q1.id, "Mia Archer Q1")).error, null, "December member can set Q1");
    assert.ok((await add("december", q4.id, "Q4?")).error, "but not Q4");
    assert.ok((await add("leaver", q1.id, "x")).error, "leaver cannot");
    const theirs = ok(await client.december.from("personal_goals").select("user_id, season_id"), "own") as { user_id: string; season_id: string | null }[];
    assert.ok(theirs.every((g) => g.user_id === member.december.id), "owner only");
    const q1Count = ok(await client.noah.from("personal_goals").select("id").eq("season_id", q1.id), "q1") as unknown[];
    assert.equal(q1Count.length, 2);
  });
});

// ── Goal-scored contests: check-ins (0034) ───────────────
describe("goal check-ins", () => {
  type Checkin = { goal_id: string; user_id: string; checked_on: string; value: number };
  const forumToday = async () => ok(await admin.rpc("forum_today"), "forum_today") as unknown as string;
  let today = "";
  let q1Goal = "";
  const checkins = (k: PersonaKey) =>
    client[k].from("goal_checkins").select("goal_id, user_id, checked_on, value").then((r) => ok(r, `checkins ${k}`) as Checkin[]);

  before(async () => {
    today = await forumToday();
    // the Q4 rules as inserted: a WHOOP race with a ladder and no check-in fine
    const rules = ok(await admin.from("seasons").select("contest_name, scoring, ladder, missed_checkin_fine").eq("id", q4.id).single(), "q4 rules") as {
      contest_name: string; scoring: string; ladder: number[]; missed_checkin_fine: number | null;
    };
    assert.deepEqual(rules, LEAK_Q4_RULES);
    // past check-ins, written by the service role: one on each Q4 goal, one on a Q1 goal of Diego (January)
    for (const k of ["founding", "noah"] as const) {
      ok(await admin.from("goal_checkins").insert({ goal_id: goalId[k], user_id: member[k].id, checked_on: "2026-10-01", value: 3, note: `checkin ${k}` }), "checkin");
    }
    const g = ok(await admin.from("goals").insert({ user_id: member.january.id, title: "Q1 Diego", season_id: q1.id, target_value: 10 }).select("id").single(), "q1 goal") as { id: string };
    q1Goal = g.id;
    ok(await admin.from("goal_checkins").insert({ goal_id: q1Goal, user_id: member.january.id, checked_on: q1.starts_on, value: 4 }), "q1 checkin");
  });

  it("members see check-ins only for seasons they can see; leavers and undated members see none", async () => {
    for (const k of KEYS) {
      const rows = await checkins(k);
      const goals = sorted(rows.map((r) => r.goal_id));
      const expect = active(k)
        ? sorted([...(seesSeason(k, q4) ? [goalId.founding, goalId.noah] : []), ...(seesSeason(k, q1) ? [q1Goal] : [])])
        : [];
      assert.deepEqual(goals, expect, `${k} check-ins`);
    }
    // December and January joined after Q4: none of its check-ins
    for (const k of ["december", "january"] as const) assert.ok(!(await checkins(k)).some((r) => r.goal_id === goalId.noah), `${k} cannot see Q4`);
  });

  it("season_goal_board follows the same rule", async () => {
    for (const k of KEYS) {
      const rows = ok(await client[k].from("season_goal_board").select("season_id, goal_id"), "board") as { season_id: string; goal_id: string }[];
      const mine = rows.filter((r) => [goalId.founding, goalId.noah, q1Goal].includes(r.goal_id));
      for (const r of mine) assert.ok(seesSeason(k, seasons.find((s) => s.id === r.season_id)!) && active(k), `${k} sees ${r.season_id}`);
      if (!active(k)) assert.equal(rows.length, 0, `${k} sees no board`);
    }
  });

  it("a member writes only their own check-in, on their own goal, today, inside the season", async () => {
    const q4Running = today >= q4.starts_on && today <= q4.ends_on;
    // someone else's goal, as themselves or as the owner
    assert.ok((await client.founding.from("goal_checkins").insert({ goal_id: goalId.noah, user_id: member.founding.id, value: 9 })).error, "not on another's goal");
    assert.ok((await client.founding.from("goal_checkins").insert({ goal_id: goalId.noah, user_id: member.noah.id, value: 9 })).error, "not as another member");
    // backdated
    assert.ok((await client.noah.from("goal_checkins").insert({ goal_id: goalId.noah, user_id: member.noah.id, checked_on: "2026-10-02", value: 9 })).error, "no backdating");
    // a season that has not started (Q1 for Diego during Q4)
    if (today < q1.starts_on) {
      assert.ok((await client.january.from("goal_checkins").insert({ goal_id: q1Goal, user_id: member.january.id, value: 5 })).error, "not before the season starts");
    }
    // a member who left
    assert.ok((await client.leaver.from("goal_checkins").insert({ goal_id: goalId.founding, user_id: member.leaver.id, value: 1 })).error, "leaver cannot");
    // own goal, today, in a running season: allowed, and it becomes the goal's current value
    if (q4Running) {
      assert.equal((await client.noah.from("goal_checkins").insert({ goal_id: goalId.noah, user_id: member.noah.id, value: 6, note: "today" })).error, null, "own check-in today");
      const g = ok(await admin.from("goals").select("current_value").eq("id", goalId.noah).single(), "goal") as { current_value: number };
      assert.equal(Number(g.current_value), 6);
      // edit today's own check-in: yes; someone else's: silently nothing
      assert.equal((await client.noah.from("goal_checkins").update({ value: 7 }).eq("goal_id", goalId.noah).eq("checked_on", today)).error, null);
      await client.founding.from("goal_checkins").update({ value: 99 }).eq("goal_id", goalId.noah).eq("checked_on", today);
      const mine = ok(await admin.from("goal_checkins").select("value").eq("goal_id", goalId.noah).eq("checked_on", today).single(), "today") as { value: number };
      assert.equal(Number(mine.value), 7, "founding could not change Noah's check-in");
    }
    // the past check-in cannot be edited, even by its owner
    await client.noah.from("goal_checkins").update({ value: 50 }).eq("goal_id", goalId.noah).eq("checked_on", "2026-10-01");
    await client.founding.from("goal_checkins").update({ value: 50 }).eq("goal_id", goalId.noah).eq("checked_on", "2026-10-01");
    const past = ok(await admin.from("goal_checkins").select("value").eq("goal_id", goalId.noah).eq("checked_on", "2026-10-01").single(), "past") as { value: number };
    assert.equal(Number(past.value), 3);
    // no deletes
    await client.noah.from("goal_checkins").delete().eq("goal_id", goalId.noah);
    assert.ok(((await admin.from("goal_checkins").select("id").eq("goal_id", goalId.noah)).data ?? []).length >= 1, "no deletes");
  });

  it("fines: members cannot book them or write contest_fines; the cron books none for a WHOOP-scored season with no missed-check-in fine", async () => {
    const book = await client.founding.rpc("book_checkin_fine", {
      p_season: q4.id, p_user: member.noah.id, p_period_start: q4.starts_on, p_period_end: q4.starts_on, p_note: "x",
    });
    assert.ok(book.error, "book_checkin_fine is service role only");
    assert.ok((await (client.founding as unknown as SupabaseClient).from("contest_fines").insert({ season_id: q4.id, user_id: member.noah.id, period_start: q4.starts_on, amount: 1 })).error, "no client writes");
    const { runCheckinFines } = await import("@/lib/agents");
    const r = await runCheckinFines(admin, { dry: false });
    assert.equal(r.seasons.find((x) => x.season === q4.slug)?.booked ?? 0, 0, "Q4 sets no fine rule");
    const q4Fines = ok(await (admin as unknown as SupabaseClient).from("contest_fines").select("user_id").eq("season_id", q4.id), "q4 fines") as unknown[];
    assert.equal(q4Fines.length, 0, "nothing booked against Q4");
    assert.ok((await admin.rpc("book_checkin_fine", { p_season: q4.id, p_user: member.noah.id, p_period_start: q4.starts_on, p_period_end: "2026-09-30", p_note: "x" })).error, "Q4 sets no fine");
  });

  it("fines: a season with a fine books each missed period once, as a contest penalty in the kitty", async () => {
    // a goal season that ended last month, with a weekly fine; Noah sets a goal and checks in once
    const start = "2026-02-02";
    const s = ok(
      await admin
        .from("seasons")
        .insert({ slug: "leak-fines", name: "Leak Fines", starts_on: start, ends_on: "2026-02-22", scoring: "goals", contest_name: "Leak race", missed_checkin_fine: 500000 })
        .select("id, slug, name, starts_on, ends_on")
        .single(),
      "fine season"
    ) as Season;
    try {
      const g = ok(await admin.from("goals").insert({ user_id: member.noah.id, title: "fines goal", season_id: s.id, target_value: 10, created_at: "2026-01-01T00:00:00Z" }).select("id").single(), "goal") as { id: string };
      ok(await admin.from("goal_checkins").insert({ goal_id: g.id, user_id: member.noah.id, checked_on: "2026-02-10", value: 5 }), "one check-in");
      const { runCheckinFines } = await import("@/lib/agents");
      const first = await runCheckinFines(admin, { dry: false });
      const mine = first.seasons.find((x) => x.season === "leak-fines");
      // Noah joined in July 2026, after this season: he owes nothing for it
      assert.equal(mine?.booked, 0, "no fines before the member joined");

      // the founding member owes all three weeks and checked in once
      const fg = ok(await admin.from("goals").insert({ user_id: member.founding.id, title: "founding fines goal", season_id: s.id, target_value: 10, created_at: "2026-01-01T00:00:00Z" }).select("id").single(), "goal f") as { id: string };
      ok(await admin.from("goal_checkins").insert({ goal_id: fg.id, user_id: member.founding.id, checked_on: "2026-02-03", value: 5 }), "founding check-in");
      const second = await runCheckinFines(admin, { dry: false });
      assert.equal(second.seasons.find((x) => x.season === "leak-fines")?.booked, 2, "two missed weeks booked");
      const again = await runCheckinFines(admin, { dry: false });
      assert.equal(again.seasons.find((x) => x.season === "leak-fines")?.booked, 0, "never twice");
      const lines = ok(await (admin as unknown as SupabaseClient).from("kitty_entries").select("amount_vnd, category, member_id, note").like("note", "Missed check-in%Leak Fines%"), "lines") as { amount_vnd: number; category: string; member_id: string }[];
      assert.equal(lines.length, 2);
      assert.ok(lines.every((l) => l.category === "penalty" && Number(l.amount_vnd) === 500000 && l.member_id === member.founding.id));
    } finally {
      const ids = ((await (admin as unknown as SupabaseClient).from("contest_fines").select("kitty_entry_id").eq("season_id", s.id)).data ?? []).map((x: { kitty_entry_id: string }) => x.kitty_entry_id);
      await admin.from("contest_fines").delete().eq("season_id", s.id);
      if (ids.length) await (admin as unknown as SupabaseClient).from("kitty_entries").delete().in("id", ids);
      await admin.from("goals").delete().eq("season_id", s.id);
      await admin.from("seasons").delete().eq("id", s.id);
    }
  });
});
