import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/session";
import { getForumContext } from "@/app/_data/context";
import { listSeasons } from "@/app/_data/forum";
import { moneyShort } from "@/app/_data/kitty";
import { contestName, seasonForDay } from "@/lib/contest";
import { contestTracks, periodWord, rhythmLabel, rulesOf } from "@/lib/goal-points";
import { getStandings } from "@/lib/standings";

const fmt = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
const ordinal = (n: number) => ["1st", "2nd", "3rd", "4th", "5th"][n] ?? `${n + 1}th`;
const WORDS = ["no one", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

// The season's rules and stakes, from its row (seasons, migration 0034).
export default async function RulesPage() {
  const supabase = await createClient();
  const user = await getSessionUser(supabase);
  if (!user) redirect("/");
  const { viewer, forum, today } = await getForumContext();
  const season = seasonForDay(await listSeasons(supabase, viewer), today);
  if (!season) redirect("/contest");
  const { currency } = forum;
  const rules = rulesOf(season);
  const tracks = contestTracks(rules, forum.whoopEnabled);
  const name = contestName(season);
  const amount = (n: number) => `${moneyShort(n, currency)} ${currency}`;
  const word = periodWord(rules.checkinDays);
  const riders = tracks.whoop ? (await getStandings(supabase, season.id)).length : 0;
  const agreed = riders > 0 && riders < WORDS.length ? `the ${WORDS[riders]}` : "the forum";
  let n = 0;
  const h = (title: string) => `${++n} · ${title}`;

  return (
    <main className="app">

      <div className="race-head">
        <div>
          <div className="eyebrow">The pact</div>
          <h1>The Rules</h1>
          <p className="sub">{season.name} · agreed by {agreed}. Amounts in {currency}.</p>
        </div>
      </div>

      <section className="card" style={{ marginTop: 0 }}>
        <h3>{h("Business goal")}</h3>
        {rules.missedGoalFine || rules.coachShareFine ? (
          <p className="rule-p">
            Each rider commits to one {season.name.split(" ")[0]} business goal. <b>Hit it and you pay nothing.</b> Miss it and
            {rules.missedGoalFine ? <><b> {amount(rules.missedGoalFine)}</b> is owed by <b>the rider</b></> : null}
            {rules.missedGoalFine && rules.coachShareFine ? " and another" : ""}
            {rules.coachShareFine ? <><b> {amount(rules.coachShareFine)}</b> by <b>their coach</b></> : null}
            {" "}— skin in the game on both sides of the 1-on-1.
          </p>
        ) : (
          <p className="rule-p">
            Each member commits to one business goal for {season.name}, with a <b>measure and a target</b>, and a coach.
          </p>
        )}
      </section>

      {tracks.goals && (
        <section className="card">
          <h3>{h(`${name} — points for checking in`)}</h3>
          <p className="rule-p">
            <b>{rhythmLabel(rules.checkinDays)}</b>, check in on your goal: this {word}&apos;s number and a note. Your newest
            check-in in each {word} counts:
          </p>
          <table className="ladder">
            <thead>
              <tr><th>For</th><th className="r">Points</th></tr>
            </thead>
            <tbody>
              <tr><td>Checking in</td><td className="r amt">{rules.pointsCheckin}</td></tr>
              <tr><td>Progress: your number against your target (half way earns half)</td><td className="r amt">up to {rules.pointsProgress}</td></tr>
              <tr><td>Streak: you checked in the {word} before too</td><td className="r amt">+{rules.pointsStreak}</td></tr>
              <tr><td>Hitting your goal (once)</td><td className="r amt">{rules.pointsGoal}</td></tr>
              {tracks.whoop && (
                <tr><td>WHOOP: your average WHOOP score, each {word} (a score of 100 earns it all)</td><td className="r amt">up to {rules.pointsProgress}</td></tr>
              )}
            </tbody>
          </table>
          <p className="rule-p" style={{ marginTop: "var(--sp-12)" }}>
            Most points leads. {rules.missedCheckinFine
              ? <>A {word} with no check-in adds <b>{amount(rules.missedCheckinFine)}</b> to the kitty.</>
              : <>A missed check-in costs no money this season, only the points and the streak.</>}
          </p>
        </section>
      )}

      {rules.ladder.length > 0 && (
        <section className="card">
          <h3>{h(tracks.goals ? "Payment by position" : `${name} — payment by position`)}</h3>
          <p className="rule-p">
            {tracks.goals ? (
              <>Final standings rank on <b>total points</b> when the season ends. Where you finish, you pay:</>
            ) : (
              <>
                Final standings rank on your average daily <b>WHOOP score — a blend of Recovery, Sleep performance and Strain</b>.
                Only days from the contest start count. A day scores once WHOOP has recorded all three numbers; your newest day (still in progress when WHOOP syncs) counts with what it has and is updated on the next sync. Where you finish, you pay:
              </>
            )}
          </p>
          <table className="ladder">
            <thead>
              <tr><th>Position</th><th className="r">Pays</th></tr>
            </thead>
            <tbody>
              {rules.ladder.map((amt, i) => (
                <tr key={i}>
                  <td>{ordinal(i)}{i === 0 ? " (winner)" : ""}</td>
                  <td className={`r amt ${amt === 0 ? "free" : "owe"}`}>{amt === 0 ? "0" : amount(amt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {tracks.whoop && (
        <section className="card">
          <h3>{h("Keep your data current")}</h3>
          <p className="rule-p">
            Keep <b>WHOOP connected</b> so every day syncs by itself. If your data goes quiet you&apos;ll get a <b>nudge</b> — keep your data
            current so the race stays honest.
          </p>
        </section>
      )}

      <section className="card">
        <h3>{h("The window")}</h3>
        <p className="rule-p">
          The {tracks.goals ? "contest" : "race"} starts <b>{fmt(season.starts_on)}</b> and runs through <b>{fmt(season.ends_on)}</b>, then the kitty settles.
        </p>
      </section>

      <section className="card">
        <h3>{h("Monthly coaching call")}</h3>
        <p className="rule-p">
          It&apos;s the <b>coach&apos;s responsibility to schedule the monthly 1-on-1 call</b> with their rider —
          a live rep at high-performance coaching.
        </p>
      </section>
    </main>
  );
}
