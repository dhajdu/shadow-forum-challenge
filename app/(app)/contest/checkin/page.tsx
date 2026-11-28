import Link from "next/link";
import { redirect } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { listSeasons } from "@/app/_data/forum";
import { shortDay, weekdayDay } from "@/app/_data/format";
import { moneyLabel } from "@/app/_data/kitty";
import { contestName, seasonForDay } from "@/lib/contest";
import { periodWord } from "@/lib/goal-points";
import { getContestBoard } from "@/lib/goal-standings";
import { CheckinForm } from "./CheckinForm";
import g from "../goalboard.module.css";

export const dynamic = "force-dynamic";

const n = (v: number) => (Number.isInteger(v) ? v.toLocaleString("en-US") : v.toLocaleString("en-US", { maximumFractionDigits: 2 }));

// The weekly check-in: this period's number for the contest goal and a note.
export default async function CheckinPage() {
  const { db, user, viewer, forum, today } = await getForumContext();
  const season = seasonForDay(await listSeasons(db, viewer), today);
  if (!season) redirect("/contest");
  const board = await getContestBoard(db, season, { whoopEnabled: forum.whoopEnabled, today });
  if (!board.tracks.goals) redirect("/contest");
  const me = board.rows.find((r) => r.user_id === user.id) ?? null;
  const goal = me?.goal ?? null;
  const word = periodWord(board.rules.checkinDays);
  const running = today >= season.starts_on && today <= season.ends_on;

  const { data: mine } = goal
    ? await db.from("goal_checkins").select("checked_on, value, note").eq("goal_id", goal.goalId).order("checked_on", { ascending: false }).limit(12)
    : { data: [] };
  const history = (mine ?? []) as { checked_on: string; value: number; note: string | null }[];
  const todays = history.find((h) => h.checked_on === today) ?? null;
  const last = history[0] ?? null;

  return (
    <main className="app">
      <Link href="/contest" className="back">← back to the board</Link>
      <div className="race-head">
        <div>
          <div className="eyebrow">{contestName(season)} · {season.name}</div>
          <h1>Check in</h1>
          <p className="sub">
            Thirty seconds a {word}.
            {board.rules.missedCheckinFine
              ? ` A missed check-in adds ${moneyLabel(board.rules.missedCheckinFine, forum.currency)} to the kitty.`
              : ""}
          </p>
        </div>
      </div>

      {!goal ? (
        <section className="card">
          <h3>No goal yet</h3>
          <p className="rule-p">Set your contest goal with a measure and a target, then check in on it.</p>
          <Link href="/welcome" className="btn inline" style={{ marginTop: "var(--sp-12)" }}>Set your goal</Link>
        </section>
      ) : !running ? (
        <section className="card">
          <h3>{goal.title}</h3>
          <p className="rule-p">
            {today < season.starts_on ? `Check-ins open on ${weekdayDay(season.starts_on)}.` : "The season is over; check-ins are closed."}
          </p>
        </section>
      ) : (
        <section className="card">
          <h3>{me?.score?.checkedInNow ? `This ${word}'s check-in` : `This ${word}`}</h3>
          <p className={g.goalTitle}>{goal.title}</p>
          <p className="dim" style={{ marginBottom: "var(--sp-12)" }}>
            {goal.target != null ? `Target ${n(goal.target)}${goal.unit ? ` ${goal.unit}` : ""}` : "No target set"}
            {last ? ` · last ${n(Number(last.value))} on ${shortDay(last.checked_on)}` : ""}
            {me?.score?.nextDue ? ` · ${me.score.checkedInNow ? "next by" : "due"} ${weekdayDay(me.score.nextDue)}` : ""}
          </p>
          <CheckinForm
            label={`This ${word}`}
            unit={goal.unit}
            value={todays ? Number(todays.value) : last ? Number(last.value) : null}
            note={todays?.note ?? null}
          />
        </section>
      )}

      {history.length > 0 && (
        <section className="card">
          <h3>Your check-ins</h3>
          <ul className={g.history}>
            {history.map((h) => (
              <li key={h.checked_on}>
                <span className={g.when}>{shortDay(h.checked_on)}</span>
                <span className={g.note}>{h.note ?? ""}</span>
                <span className={g.val}>{n(Number(h.value))}{goal?.unit ? ` ${goal.unit}` : ""}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
