import Link from "next/link";
import { notFound } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { listAllSeasons } from "@/app/_data/forum";
import { longDay } from "@/app/_data/format";
import { contestName } from "@/lib/contest";
import { rulesOf } from "@/lib/goal-points";
import { RulesForm, SeasonForm } from "./SeasonForm";
import s from "../members/members.module.css";
import g from "../../contest/goalboard.module.css";

const SCORED: Record<string, string> = { goals: "goal check-ins", whoop: "WHOOP", both: "goal check-ins and WHOOP" };

export default async function SeasonsPage() {
  const { db, viewer, forum } = await getForumContext();
  if (!viewer.is_admin) notFound();
  const seasons = await listAllSeasons(db, viewer);
  return (
    <main className="page">
      <Link href="/me/members" className="back">← Members and access</Link>
      <header className="page-head">
        <div className="eyebrow">Admin</div>
        <h1>Seasons</h1>
        <p className="sub">
          A member sees a season if it is still running on or after their first forum. Each season sets its own contest: how it
          is scored, how often members check in, the points and the stakes. Amounts are in {forum.currency}.
        </p>
      </header>
      <div className={s.grid}>
        <section className="zone-card">
          <h2>Seasons and contest rules</h2>
          {seasons.map((x) => {
            const rules = rulesOf(x);
            return (
              <div key={x.id} className={g.season}>
                <h3>{x.name}</h3>
                <p className="note-line">
                  {longDay(x.starts_on)} to {longDay(x.ends_on)} ·{" "}
                  {rules.scoring ? `${contestName(x)}, scored on ${SCORED[rules.scoring]}` : "no contest yet"}
                </p>
                <details>
                  <summary className="btn-ghost inline">Edit rules</summary>
                  <RulesForm id={x.id} rules={rules} currency={forum.currency} whoopEnabled={forum.whoopEnabled} />
                </details>
              </div>
            );
          })}
        </section>
        <section className="zone-card">
          <h2>New season</h2>
          <SeasonForm whoopEnabled={forum.whoopEnabled} />
        </section>
      </div>
    </main>
  );
}
