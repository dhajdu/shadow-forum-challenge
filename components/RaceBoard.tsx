import Link from "next/link";
import { STALE_DAYS, type Standing } from "@/lib/standings";
import { placementPenalty } from "@/lib/contest";
import type { GoalStatus } from "@/lib/database.types";
import styles from "./RaceBoard.module.css";

const RUNNER = (
  <svg viewBox="0 0 18 26" aria-hidden>
    <circle cx="9" cy="4" r="3" />
    <path d="M9 7.4c-2.1 0-3.4 1.3-3.4 3.3v5.2l-1.9 5.6 2.1.8 2-5.6h.4l2 5.6 2.1-.8-1.9-5.6v-5.2c0-2-1.3-3.3-3.5-3.3z" />
  </svg>
);

const STATUS_LABEL: Record<GoalStatus, string> = {
  on_track: "on track",
  at_risk: "at risk",
  behind: "behind",
  hit: "hit",
};

export type RaceRow = Standing & {
  goal: { title: string; status: GoalStatus } | null;
  coach: string | null;
};

// One standings table — each rider appears once: place, name (+ goal & coach), lane, avg, days, owes.
export function RaceBoard({ rows }: { rows: RaceRow[] }) {
  const max = Math.max(100, ...rows.map((s) => s.avg));

  return (
    <div className="board">
      <div className="board-head">
        <h2>Standings</h2>
        <span className="lanelbl-r">deepest into the shadow leads</span>
      </div>
      <div className={styles.head}>
        <span />
        <span>Rider</span>
        <span className={styles.lanes}>
          <span>◐ the light</span>
          <span>the shadow ●</span>
        </span>
        <span className={styles.r}>Avg</span>
        <span className={styles.r}>Days</span>
        <span className={styles.r}>Owes</span>
      </div>

      <div className={styles.rows}>
        {rows.map((s, i) => {
          const pos = max > 0 ? (s.avg / max) * 100 : 0;
          const owes = placementPenalty(i);
          return (
            <div key={s.user_id} className={`lane p${i + 1} ${styles.row}`}>
              <div className={`medal ${styles.medal}`}>{i + 1}</div>
              <div className={`rname ${styles.name}`}>
                <Link href={`/rider/${s.user_id}`}>{s.full_name}</Link>
                {s.stale && (
                  <span className="stale" title={`No WHOOP upload in over ${STALE_DAYS} days`} aria-label="Overdue upload">
                    !
                  </span>
                )}
                <small>
                  Goal{" "}
                  {s.goal ? (
                    <span className={`chip ${s.goal.status} ${styles.chip}`} title={s.goal.title}>
                      {STATUS_LABEL[s.goal.status]}
                    </span>
                  ) : (
                    "not set"
                  )}
                  {s.coach && <> · coach {s.coach}</>}
                </small>
              </div>
              {s.days > 0 ? (
                <div className={`track ${styles.track}`}>
                  <div className="trail" style={{ width: `${pos}%` }} />
                  <div className="runner" style={{ left: `${pos}%` }}>
                    {RUNNER}
                  </div>
                  <div className="finish" />
                </div>
              ) : (
                <div className={styles.pending}>Upload pending</div>
              )}
              <div className={`score ${styles.avg}`}>
                {s.avg || "—"}
                <small>avg</small>
              </div>
              <div className={styles.days} title="Days scored · contest days WHOOP didn't record">
                {s.days}
                <small>{s.missed} missed</small>
              </div>
              <div className={`${styles.owes} ${owes === 0 ? styles.free : styles.owe}`}>
                {owes === 0 ? "0" : `${owes}M`}
                <small>owes</small>
              </div>
            </div>
          );
        })}
      </div>

      <div className="board-foot">
        A rider&apos;s silhouette sits at their average WHOOP score, from the light into the shadow · pot: 1st pays 0,
        then 2M–5M · business goal miss = 5M rider + 5M coach, settled at year end.
      </div>
    </div>
  );
}
