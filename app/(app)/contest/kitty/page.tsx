import { createClient } from "@/lib/supabase/server";
import { buildReport } from "@/lib/report";
import { coachNameFor } from "@/lib/roster";
import type { GoalStatus } from "@/lib/database.types";
import { getForumContext } from "@/app/_data/context";
import { listSeasons } from "@/app/_data/forum";
import { moneyShort } from "@/app/_data/kitty";
import { seasonForDay } from "@/lib/contest";

const ordinal = (n: number) => ["1st", "2nd", "3rd", "4th", "5th"][n - 1] ?? `${n}th`;
const fmt = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// The provisional kitty: placement stakes as the contest stands today (the same numbers the
// Bookkeeper books once the season ends), check-in fines already booked, plus the goal
// stakes that settle at the end. Amounts from the season's rules, in the forum's currency.
export default async function KittyPage() {
  const supabase = await createClient();
  const { viewer, forum, today } = await getForumContext();
  const season = seasonForDay(await listSeasons(supabase, viewer), today);
  const report = await buildReport(supabase, season ?? undefined);
  const { rules, tracks } = report;
  const m = (n: number) => moneyShort(n, forum.currency);
  const placement = report.standings.reduce((a, r) => a + r.owes, 0);
  const goalStake = (rules.missedGoalFine ?? 0) + (rules.coachShareFine ?? 0);
  const atRisk = (s: GoalStatus) => s === "behind" || s === "at_risk";

  // missed check-in fines already in the kitty this season
  const { data: fines } = season && tracks.goals && rules.missedCheckinFine
    ? await supabase.from("contest_fines").select("user_id, amount").eq("season_id", season.id)
    : { data: [] };
  const finesByUser = new Map<string, number>();
  for (const f of (fines ?? []) as { user_id: string; amount: number }[]) finesByUser.set(f.user_id, (finesByUser.get(f.user_id) ?? 0) + Number(f.amount));
  const finesTotal = [...finesByUser.values()].reduce((a, b) => a + b, 0);

  return (
    <main className="app">
      <div className="race-head">
        <div>
          <div className="eyebrow">Provisional kitty</div>
          <h1>{m(placement + finesTotal)} {forum.currency}</h1>
          <p className="sub">
            {tracks.goals ? "From places on the board today" : "From race placement today"}
            {finesTotal > 0 ? " and missed check-ins" : ""}.
            {season ? ` Final after ${fmt(season.ends_on)}` : ""}
            {goalStake > 0 ? `; goals decide up to ${m(goalStake)} more each.` : "."}
          </p>
        </div>
      </div>

      {rules.ladder.length > 0 && (
        <section className="card">
          <h3>Placement</h3>
          <table className="ladder">
            <thead>
              <tr>
                <th>Place</th>
                <th>{tracks.goals ? "Member" : "Rider"}</th>
                <th className="r">{tracks.goals ? "Points" : "Avg"}</th>
                <th className="r">Pays</th>
              </tr>
            </thead>
            <tbody>
              {report.standings.map((r) => (
                <tr key={r.user_id}>
                  <td>{ordinal(r.rank)}</td>
                  <td>{r.name}</td>
                  <td className="r">{tracks.goals ? (r.points ?? 0) : r.avg || "—"}</td>
                  <td className={`r amt ${r.owes === 0 ? "free" : "owe"}`}>{r.owes === 0 ? "0" : m(r.owes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tracks.goals && rules.missedCheckinFine && (
        <section className="card">
          <h3>Missed check-ins</h3>
          <p className="rule-p">
            Each {rules.checkinDays === 7 ? "week" : "period"} without a check-in adds <b>{m(rules.missedCheckinFine)}</b> to the kitty as a contest penalty.
          </p>
          <table className="ladder">
            <thead>
              <tr><th>Member</th><th className="r">Missed</th><th className="r">Booked</th></tr>
            </thead>
            <tbody>
              {report.standings.map((r) => (
                <tr key={r.user_id}>
                  <td>{r.name}</td>
                  <td className="r">{r.goal?.missed ?? 0}</td>
                  <td className={`r amt ${finesByUser.get(r.user_id) ? "owe" : "free"}`}>{m(finesByUser.get(r.user_id) ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {goalStake > 0 && (
        <section className="card goals-card">
          <h3>Business goals</h3>
          <p className="rule-p">
            Settled at the end of the season: a missed goal costs
            {rules.missedGoalFine ? <> the rider <b>{m(rules.missedGoalFine)}</b></> : null}
            {rules.missedGoalFine && rules.coachShareFine ? " and" : ""}
            {rules.coachShareFine ? <> their coach <b>{m(rules.coachShareFine)}</b></> : null}.
          </p>
          <table className="ladder">
            <thead>
              <tr><th>{tracks.goals ? "Member" : "Rider"}</th><th>Coach</th><th>Goal</th><th className="r">If missed</th></tr>
            </thead>
            <tbody>
              {report.standings.map((r) => (
                <tr key={r.user_id}>
                  <td>{r.name}</td>
                  <td className="dim">{coachNameFor(r.user_id, forum) ?? "—"}</td>
                  <td><span className={`chip ${r.goalStatus}`}>{r.goalStatus.replace("_", " ")}</span></td>
                  <td className={`r amt ${atRisk(r.goalStatus) ? "owe" : "dim"}`}>
                    {r.goalStatus === "hit" ? "0" : m(goalStake)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </main>
  );
}
