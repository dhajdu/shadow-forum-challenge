import Link from "next/link";
import { getForumContext } from "@/app/_data/context";
import { moneyShort, moneyLabel } from "@/app/_data/kitty";
import { weekdayDay } from "@/app/_data/format";
import type { Season } from "@/app/_data/types";
import { contestName, dayOfSeason, seasonLength } from "@/lib/contest";
import { periodWord, rhythmLabel } from "@/lib/goal-points";
import { getContestBoard, type BoardRow } from "@/lib/goal-standings";
import styles from "./race.module.css";
import g from "./goalboard.module.css";

const due = (r: BoardRow) => {
  const s = r.score;
  if (!s) return "No goal yet";
  if (s.checkedInNow) return s.nextDue ? `Done · next by ${weekdayDay(s.nextDue)}` : "Done";
  return s.nextDue ? `Due ${weekdayDay(s.nextDue)}` : "—";
};

// The goal-scored contest: points for check-ins, progress, streaks and hitting
// the goal, plus WHOOP points when the season scores both (lib/goal-standings).
export async function GoalBoard({ season }: { season: Season }) {
  const { db, user, forum, today } = await getForumContext();
  const board = await getContestBoard(db, season, { whoopEnabled: forum.whoopEnabled, today });
  const { rules, tracks, rows } = board;
  const me = rows.find((r) => r.user_id === user.id) ?? null;
  const pot = rules.ladder.reduce((a, b) => a + b, 0);
  const word = periodWord(rules.checkinDays);
  const withGoal = rows.filter((r) => r.score);
  const inNow = withGoal.filter((r) => r.score!.checkedInNow).length;
  const running = today >= season.starts_on && today <= season.ends_on;

  return (
    <main className="app">
      <div className="race-head">
        <div>
          <div className="eyebrow">
            Contest · {season.name} ·{" "}
            {running ? (
              <>day {dayOfSeason(season)} of {seasonLength(season)} · <span className="live">● live</span></>
            ) : today < season.starts_on ? (
              `starts ${weekdayDay(season.starts_on)}`
            ) : (
              "season over"
            )}
          </div>
          <h1>{contestName(season)}</h1>
          <p className="sub">
            {rhythmLabel(rules.checkinDays)} check-ins on your goal. Points for checking in, progress and streaks
            {rules.pointsGoal > 0 ? `; ${rules.pointsGoal} for hitting it` : ""}
            {tracks.whoop ? ", plus your WHOOP score" : ""}.
          </p>
        </div>
      </div>

      <div className={styles.layout}>
        <section className="card" style={{ marginTop: 0 }}>
          <h3>Leaderboard</h3>
          {rows.length === 0 ? (
            <p className="trend-empty">No goals on the board yet. Set yours to get on it.</p>
          ) : (
            <table className={`ladder ${g.board}`}>
              <thead>
                <tr>
                  <th className="r">#</th>
                  <th>Member</th>
                  <th className="r">Points</th>
                  <th className="r">Streak</th>
                  <th>Goal</th>
                  {tracks.whoop && <th className="r">WHOOP</th>}
                  <th className={g.hideSm}>Next check-in</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.user_id} className={r.user_id === user.id ? g.me : undefined}>
                    <td className={`r ${g.num} ${r.rank === 1 ? g.first : ""}`}>{r.rank}</td>
                    <td>
                      <b className={g.name}>{r.user_id === user.id ? "You" : r.full_name}</b>
                      {r.goal && <small className={g.goal}>{r.goal.title}</small>}
                    </td>
                    <td className={`r ${g.num}`}>{r.points}</td>
                    <td className={`r ${g.num}`}>{r.score ? r.score.streak : "—"}</td>
                    <td>
                      {r.score?.pct != null ? (
                        <span className={g.pct}>
                          <span className={g.bar} aria-hidden>
                            <i style={{ width: `${r.score.pct}%` }} />
                          </span>
                          <span className={g.num}>{r.score.pct}%</span>
                        </span>
                      ) : r.goal ? (
                        <span className={`chip ${r.goal.status}`}>{r.goal.status.replace("_", " ")}</span>
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </td>
                    {tracks.whoop && <td className={`r ${g.num}`}>{r.whoopAvg ?? "—"}</td>}
                    <td className={`${g.hideSm} ${r.score && !r.score.checkedInNow ? g.dueCell : "dim"}`}>{due(r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <aside className={styles.side}>
          <section className="card">
            <h3>You</h3>
            <div className={styles.youStats}>
              <div>
                <b>{me ? `#${me.rank}` : "—"}</b>
                <span>place</span>
              </div>
              <div>
                <b>{me?.points ?? 0}</b>
                <span>points</span>
              </div>
              <div>
                <b>{me?.score?.streak ?? 0}</b>
                <span>{word} streak</span>
              </div>
            </div>
            {me?.goal ? (
              <>
                <p className="dim">{due(me)}</p>
                {running && (
                  <Link href="/contest/checkin" className={`btn ${styles.btn}`}>
                    {me.score?.checkedInNow ? "Update this check-in" : "Check in"}
                  </Link>
                )}
              </>
            ) : (
              <>
                <p className="dim">Set your contest goal with a measure and a target to get on the board.</p>
                <Link href="/welcome" className={`btn ${styles.btn}`}>Set your goal</Link>
              </>
            )}
          </section>

          <div className={`kpis ${styles.kpis}`}>
            <div className="kpi">
              <b>{inNow}/{withGoal.length}</b>
              <span>checked in this {word}</span>
            </div>
            {pot > 0 && (
              <div className="kpi k-kitty">
                <b>{moneyShort(pot, forum.currency)}</b>
                <span>pot</span>
              </div>
            )}
          </div>

          <section className="card">
            <h3>Stakes</h3>
            <p className={`dim ${styles.line}`}>
              {rules.missedCheckinFine
                ? <>A missed check-in adds <b className={styles.ink}>{moneyLabel(rules.missedCheckinFine, forum.currency)}</b> to the kitty.</>
                : "No fine for a missed check-in this season."}
            </p>
            {pot > 0 && <p className={`dim ${styles.line}`}>Final places pay into the kitty when the season ends.</p>}
            <p className={`dim ${styles.line}`}>
              <Link href="/contest/rules" className={styles.ink}>Rules and stakes →</Link>
            </p>
          </section>
        </aside>
      </div>
    </main>
  );
}
