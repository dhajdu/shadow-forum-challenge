import { redirect } from "next/navigation";
import { NavBar } from "@/components/NavBar";
import { createClient } from "@/lib/supabase/server";
import { PLACEMENT_PENALTIES, MISSED_GOAL_PENALTY, COACH_SHARE_PENALTY, CONTEST_START, CONTEST_END } from "@/lib/contest";

const fmt = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const ordinal = (n: number) => ["1st", "2nd", "3rd", "4th", "5th"][n] ?? `${n + 1}th`;

export default async function RulesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/");

  return (
    <main className="app">
      <NavBar active="rules" />

      <div className="race-head">
        <div>
          <div className="eyebrow">The pact</div>
          <h1>The Rules</h1>
          <p className="sub">Q4 2026 · agreed by the five. Amounts in VND.</p>
        </div>
      </div>

      <section className="card" style={{ marginTop: 0 }}>
        <h3>1 · Business goal</h3>
        <p className="rule-p">
          Each rider commits to one Q4 business goal. <b>Hit it and you pay nothing.</b> Miss it and
          <b> {MISSED_GOAL_PENALTY}M VND</b> is owed by <b>the rider</b> and another
          <b> {COACH_SHARE_PENALTY}M VND</b> by <b>their coach</b> — skin in the game on both sides of the 1-on-1.
        </p>
      </section>

      <section className="card">
        <h3>2 · Race Into the Shadow — payment by position</h3>
        <p className="rule-p">
          Final standings rank on your average daily <b>WHOOP score — a blend of Recovery, Sleep performance and Strain</b>.
          A missing number counts as 0 for that day (except a day still in progress when you export — it scores on your next upload). Where you finish, you pay:
        </p>
        <table className="ladder">
          <thead>
            <tr><th>Position</th><th className="r">Pays</th></tr>
          </thead>
          <tbody>
            {PLACEMENT_PENALTIES.map((amt, i) => (
              <tr key={i}>
                <td>{ordinal(i)}{i === 0 ? " (winner)" : ""}</td>
                <td className={`r amt ${amt === 0 ? "free" : "owe"}`}>{amt === 0 ? "0" : `${amt}M VND`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>3 · Keep your data current</h3>
        <p className="rule-p">
          Upload your WHOOP export regularly. You&apos;ll get a <b>weekly nudge</b> to upload — keep your data
          current so the race stays honest.
        </p>
      </section>

      <section className="card">
        <h3>4 · The window</h3>
        <p className="rule-p">
          The race starts <b>{fmt(CONTEST_START)}</b> and runs through <b>{fmt(CONTEST_END)}</b>, then the kitty settles.
        </p>
      </section>

      <section className="card">
        <h3>5 · Monthly coaching call</h3>
        <p className="rule-p">
          It&apos;s the <b>coach&apos;s responsibility to schedule the monthly 1-on-1 call</b> with their rider —
          a live rep at high-performance coaching.
        </p>
      </section>
    </main>
  );
}
