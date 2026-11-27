import { createClient } from "@/lib/supabase/server";
import { buildReport } from "@/lib/report";
import { coachNameFor } from "@/lib/roster";
import { CONTEST_END, COACH_SHARE_PENALTY, MISSED_GOAL_PENALTY } from "@/lib/contest";
import type { GoalStatus } from "@/lib/database.types";

const ordinal = (n: number) => ["1st", "2nd", "3rd", "4th", "5th"][n - 1] ?? `${n}th`;
const fmt = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// The provisional kitty: placement penalties as the race stands today (the same numbers the
// Bookkeeper books once the season ends), plus the goal penalties that settle on 31 Dec.
export default async function KittyPage() {
  const supabase = await createClient();
  const report = await buildReport(supabase);
  const placement = report.standings.reduce((a, r) => a + r.owes, 0);
  const atRisk = (s: GoalStatus) => s === "behind" || s === "at_risk";

  return (
    <main className="app">
      <div className="race-head">
        <div>
          <div className="eyebrow">Provisional kitty</div>
          <h1>{placement}M VND</h1>
          <p className="sub">
            From race placement today. Final after {fmt(CONTEST_END)}; goals decide up to {MISSED_GOAL_PENALTY + COACH_SHARE_PENALTY}M more each.
          </p>
        </div>
      </div>

      <section className="card">
        <h3>Placement</h3>
        <table className="ladder">
          <thead>
            <tr><th>Place</th><th>Rider</th><th className="r">Avg</th><th className="r">Pays</th></tr>
          </thead>
          <tbody>
            {report.standings.map((r) => (
              <tr key={r.user_id}>
                <td>{ordinal(r.rank)}</td>
                <td>{r.name}</td>
                <td className="r">{r.avg || "—"}</td>
                <td className={`r amt ${r.owes === 0 ? "free" : "owe"}`}>{r.owes === 0 ? "0" : `${r.owes}M`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card goals-card">
        <h3>Business goals</h3>
        <p className="rule-p">
          Settled on 31 Dec: a missed goal costs the rider <b>{MISSED_GOAL_PENALTY}M</b> and their coach <b>{COACH_SHARE_PENALTY}M</b>.
        </p>
        <table className="ladder">
          <thead>
            <tr><th>Rider</th><th>Coach</th><th>Goal</th><th className="r">If missed</th></tr>
          </thead>
          <tbody>
            {report.standings.map((r) => (
              <tr key={r.user_id}>
                <td>{r.name}</td>
                <td className="dim">{coachNameFor(r.name) ?? "—"}</td>
                <td><span className={`chip ${r.goalStatus}`}>{r.goalStatus.replace("_", " ")}</span></td>
                <td className={`r amt ${atRisk(r.goalStatus) ? "owe" : "dim"}`}>
                  {r.goalStatus === "hit" ? "0" : `${MISSED_GOAL_PENALTY + COACH_SHARE_PENALTY}M`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
