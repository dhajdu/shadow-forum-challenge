import Link from "next/link";
import type { Standing } from "@/lib/standings";
import { placementPenalty } from "@/lib/contest";

const RUNNER = (
  <svg viewBox="0 0 18 26" aria-hidden>
    <circle cx="9" cy="4" r="3" />
    <path d="M9 7.4c-2.1 0-3.4 1.3-3.4 3.3v5.2l-1.9 5.6 2.1.8 2-5.6h.4l2 5.6 2.1-.8-1.9-5.6v-5.2c0-2-1.3-3.3-3.5-3.3z" />
  </svg>
);

export function RaceBoard({ standings }: { standings: Standing[] }) {
  const max = Math.max(100, ...standings.map((s) => s.avg));

  return (
    <div className="board">
      <div className="board-head">
        <h2>Standings</h2>
        <span className="lanelbl-r">deepest into the shadow leads</span>
      </div>
      <div className="lanelbl">
        <span>◐ the light</span>
        <span>the shadow ●</span>
      </div>

      {standings.map((s, i) => {
        const pos = max > 0 ? (s.avg / max) * 100 : 0;
        return (
          <Link key={s.user_id} href={`/rider/${s.user_id}`} className={`lane p${i + 1}`}>
            <div className="medal">{i + 1}</div>
            <div className="rname">
              {s.full_name}
              <small>{s.days} days</small>
            </div>
            <div className="track">
              <div className="trail" style={{ width: `${pos}%` }} />
              <div className="runner" style={{ left: `${pos}%` }}>
                {RUNNER}
              </div>
              <div className="finish" />
            </div>
            <div className="score">
              {s.avg || "—"}
              <small>avg</small>
            </div>
          </Link>
        );
      })}

      <div className="board-foot">
        Each lane runs from the light into the shadow · a rider&apos;s silhouette sits at their average
        WHOOP score · deepest in the shadow leads &amp; pays nothing.
      </div>

      <table className="ladder">
        <thead>
          <tr>
            <th>Place</th>
            <th>Rider</th>
            <th className="r">Owes</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((s, i) => {
            const owes = placementPenalty(i);
            return (
              <tr key={s.user_id}>
                <td>{i + 1}</td>
                <td>{s.full_name}</td>
                <td className={`r amt ${owes === 0 ? "free" : "owe"}`}>{owes === 0 ? "0" : `${owes}M`}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
