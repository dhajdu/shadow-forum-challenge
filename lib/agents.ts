// Core agent logic, shared by the individual cron routes and the daily aggregator.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { getStandings } from "@/lib/standings";
import { contestName, hasContest, seasonPenalty, seasonPhase } from "@/lib/contest";
import { contestTracks, rulesOf } from "@/lib/goal-points";
import { getContestBoard } from "@/lib/goal-standings";
import { getForumSettings } from "@/lib/forum-settings";
import { todayIn } from "@/app/_data/format";
import { sendEmail } from "@/lib/notify";
import { selectAll } from "@/lib/supabase/selectAll";
import { loadAccess, seasonAudience } from "@/lib/access";
import { sendPush } from "@/lib/push";

type Admin = SupabaseClient<Database>;

// ── The Steward: snapshot this week's race placing (runs Monday) ──
export async function runSteward(admin: Admin) {
  const standings = await getStandings(admin);
  const day = new Date().toISOString().slice(0, 10);
  const data = standings.map((s, i) => ({
    user_id: s.user_id,
    full_name: s.full_name,
    avg: s.avg,
    days: s.days,
    missed: s.missed,
    rank: i + 1,
  }));
  const { error } = await admin
    .from("standings_snapshots")
    .upsert({ day, data }, { onConflict: "day" });
  if (error) throw new Error(error.message);
  return { day, riders: data.length };
}

// ── The Whip: nudge riders with stale data (only sends during the contest) ──
// Only riders in today's season: members who joined after it started, or left,
// get no contest mail.
const STALE_DAYS = 7; // riders upload weekly
export async function runWhip(admin: Admin, opts: { dry: boolean }) {
  const { members, current } = await loadAccess(admin);
  const profs = seasonAudience(members, current);
  const rows = await selectAll<{ user_id: string; day: string }>((from, to) =>
    admin.from("whoop_days").select("user_id, day").order("day").order("user_id").range(from, to)
  );

  const latest = new Map<string, string>();
  for (const r of rows) {
    const cur = latest.get(r.user_id);
    if (!cur || r.day > cur) latest.set(r.user_id, r.day);
  }

  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);

  const stale = profs
    .filter((p) => {
      const l = latest.get(p.id);
      return !l || l < cutoffStr;
    })
    .map((p) => ({ id: p.id, name: p.full_name, email: p.email, lastData: latest.get(p.id) ?? null }));

  // nudges go out only while today's season is running and races on WHOOP
  // (a goal-only season, or WHOOP switched off, has no WHOOP data to chase)
  const { whoopEnabled } = await getForumSettings();
  const contestActive =
    !!current && hasContest(current) && contestTracks(rulesOf(current), whoopEnabled).whoop && seasonPhase(current, now) === "running";
  let nudged = 0;
  if (!opts.dry && contestActive) {
    for (const s of stale) {
      if (!s.email) continue;
      const res = await sendEmail({
        to: s.email,
        subject: "The Whip: your WHOOP data has gone quiet",
        html: `<p>${s.name || "Rider"}, your data is stale${
          s.lastData ? ` (last seen ${s.lastData})` : ""
        }. Upload your WHOOP export this week so your days count — and keep the strap on: days it doesn't record are logged as missed. 🏃</p>`,
      });
      if (res.ok) nudged++;
    }
    await sendPush(admin, stale.map((s) => s.id), { kind: "whip_nudge" }, members).catch(() => null);
  }
  return { contestActive, staleCount: stale.length, stale, nudged };
}

// ── The Bookkeeper: book the kitty charges ──
// Nothing is charged while a season runs: until then the kitty is shown live from
// race position. Once a season has ended it books placement from that season's
// board and ladder (re-run safely: it replaces that season's entries): the WHOOP
// race for a WHOOP season, total points for a goal-scored one.
// Business-goal penalties are settled separately.
export async function runBookkeeper(admin: Admin) {
  const { seasons } = await loadAccess(admin);
  const forum = await getForumSettings();
  // seasons without a contest (no ladder) are never booked
  const ended = seasons.filter((s) => seasonPhase(s) === "over" && hasContest(s));
  if (ended.length === 0) return { seasons: [], skipped: "no contest season has ended", entries: 0, kitty: 0 };

  const booked: { season: string; entries: number; kitty: number }[] = [];
  for (const season of ended) {
    const period = season.name.replace(/\s+/g, "-"); // "Q4 2026" -> "Q4-2026"
    // season_standings lists only that season's riders, so later joiners are never charged
    const goals = contestTracks(rulesOf(season), forum.whoopEnabled).goals;
    const ranked = goals
      ? (await getContestBoard(admin, season, { whoopEnabled: forum.whoopEnabled, today: season.ends_on })).rows
      : await getStandings(admin, season.id);
    const rows = ranked
      .map((s, i) => {
        const amount = seasonPenalty(season, i); // whole units of the forum's currency
        return {
          user_id: s.user_id,
          kind: "placement" as const,
          amount,
          amount_m: Math.round(amount / 1_000_000), // the old column, in millions
          reason: `Placement #${i + 1}`,
          period,
          season_id: season.id,
        };
      })
      .filter((r) => r.amount > 0);

    await admin.from("penalties").delete().eq("season_id", season.id);
    if (rows.length > 0) {
      const { error } = await admin.from("penalties").insert(rows);
      if (error) throw new Error(error.message);
    }
    booked.push({ season: season.slug, entries: rows.length, kitty: rows.reduce((a, b) => a + b.amount, 0) });
  }
  return {
    seasons: booked,
    entries: booked.reduce((a, b) => a + b.entries, 0),
    kitty: booked.reduce((a, b) => a + b.kitty, 0),
  };
}

// ── Check-in fines: a missed check-in becomes a kitty line ──
// Only seasons scored on goals whose rules set a missed check-in fine. Each
// period that has ended without a check-in is booked once per member
// (book_checkin_fine records it in contest_fines first), so re-runs are safe.
export async function runCheckinFines(admin: Admin, opts: { dry: boolean } = { dry: false }) {
  const { seasons } = await loadAccess(admin);
  const forum = await getForumSettings();
  const today = todayIn(forum.timeZone);
  const out: { season: string; missed: number; booked: number }[] = [];
  for (const season of seasons) {
    const rules = rulesOf(season);
    if (!rules.missedCheckinFine || !contestTracks(rules, forum.whoopEnabled).goals || today <= season.starts_on) continue;
    // only periods that ended before today count as missed
    const board = await getContestBoard(admin, season, { whoopEnabled: forum.whoopEnabled, today });
    let missed = 0;
    let booked = 0;
    for (const r of board.rows) {
      for (const p of r.score?.missed ?? []) {
        if (p.end >= today) continue;
        missed++;
        if (opts.dry) continue;
        const { data, error } = await admin.rpc("book_checkin_fine", {
          p_season: season.id,
          p_user: r.user_id,
          p_period_start: p.start,
          p_period_end: p.end,
          p_note: `Missed check-in · ${contestName(season)} · ${season.name}, ${p.start} to ${p.end}`,
        });
        if (error) throw new Error(error.message);
        if (data) booked++;
      }
    }
    out.push({ season: season.slug, missed, booked });
  }
  return { seasons: out, booked: out.reduce((a, b) => a + b.booked, 0) };
}
