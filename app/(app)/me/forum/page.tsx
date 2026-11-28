import Link from "next/link";
import { notFound } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { publicSettings } from "@/lib/forum-settings";
import { ForumSettingsForm } from "./ForumSettingsForm";
import s from "../members/members.module.css";

// Admin: the forum's name, organisation, currency, dues, time zone, site and the WHOOP switch.
export default async function ForumSettingsPage() {
  const { viewer, forum } = await getForumContext();
  if (!viewer.is_admin) notFound();
  const zones = Intl.supportedValuesOf("timeZone");
  const timeZones = zones.includes(forum.timeZone) ? zones : [forum.timeZone, ...zones];
  const whoopKeys = !!(process.env.WHOOP_CLIENT_ID && process.env.WHOOP_CLIENT_SECRET);
  const coaches = Object.entries(forum.coaches);

  return (
    <main className="page">
      <Link href="/me/members" className="back">← Members and access</Link>
      <header className="page-head">
        <div className="eyebrow">Admin</div>
        <h1>Forum settings</h1>
        <p className="sub">The forum&apos;s name, money and time zone, used across the site, the app, emails and Ask AI.</p>
      </header>
      <div className={s.grid}>
        <section className="zone-card">
          <h2>Forum</h2>
          <ForumSettingsForm value={publicSettings(forum)} timeZones={timeZones} whoopKeys={whoopKeys} />
        </section>
        <section className="zone-card">
          <h2>Contest coaches</h2>
          {coaches.length ? (
            <ul className="rows">
              {coaches.map(([rider, coach]) => (
                <li key={rider} className="row">
                  <span className="row-main">
                    <b>{rider.replace(/\b\w/g, (c) => c.toUpperCase())}</b>
                    <small>coached by {coach}</small>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="note-line">No coaches assigned yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
