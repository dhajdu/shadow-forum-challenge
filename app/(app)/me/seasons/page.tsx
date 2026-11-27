import Link from "next/link";
import { notFound } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { listAllSeasons } from "@/app/_data/forum";
import { longDay } from "@/app/_data/format";
import { SeasonForm } from "./SeasonForm";
import s from "../members/members.module.css";

export default async function SeasonsPage() {
  const { db, viewer } = await getForumContext();
  if (!viewer.is_admin) notFound();
  const seasons = await listAllSeasons(db, viewer);
  return (
    <main className="page">
      <Link href="/me" className="back">← Me</Link>
      <header className="page-head">
        <div className="eyebrow">Admin</div>
        <h1>Seasons</h1>
        <p className="sub">A member sees a season only if it starts on or after their first forum, so everyone in the forum on its first day is in it.</p>
      </header>
      <div className={s.grid}>
        <section className="zone-card">
          <h2>Seasons</h2>
          <ul className="rows">
            {seasons.map((x) => (
              <li key={x.id} className="row">
                <span className="row-main">
                  <b>{x.name}</b>
                  <small>{longDay(x.starts_on)} to {longDay(x.ends_on)}</small>
                </span>
              </li>
            ))}
          </ul>
        </section>
        <section className="zone-card">
          <h2>New season</h2>
          <SeasonForm />
        </section>
      </div>
    </main>
  );
}
