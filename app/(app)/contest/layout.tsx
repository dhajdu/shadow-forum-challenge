import { getForumContext } from "@/app/_data/context";
import { listSeasons } from "@/app/_data/forum";
import Link from "next/link";
import { SubTabs } from "@/components/TabNav";
import { hasContest, seasonForDay } from "@/lib/contest";
import { contestTracks, rulesOf } from "@/lib/goal-points";
import { PageBanner } from "@/components/PageBanner";
import s from "./contest.module.css";

const tabs = (timeZone: string, goals: boolean) => [
  ...(goals
    ? [
        { href: "/contest", label: "Board" },
        { href: "/contest/checkin", label: "Check in" },
      ]
    : [{ href: "/contest", label: "Race" }]),
  { href: "/contest/kitty", label: "Kitty" },
  { href: "/contest/rules", label: "Rules" },
  {
    href: `/contest/report/${new Date().toLocaleDateString("en-CA", { timeZone }).slice(0, 7)}`,
    label: "Report",
  },
];

// The race, rider, goal, rules and report pages keep their logic; this adds the sub-tabs.
// A member with no season they can see gets the next-season card instead of the pages.
// A season scores goal check-ins, the WHOOP race or both (seasons.scoring, 0034);
// the WHOOP race runs only while the forum has WHOOP switched on.
export default async function ContestLayout({ children }: { children: React.ReactNode }) {
  const { db, viewer, forum } = await getForumContext();
  const seasons = await listSeasons(db, viewer);
  const season = seasonForDay(seasons); // today's season: Q4 2026 until Q1 2027 starts

  const tracks = contestTracks(rulesOf(season), forum.whoopEnabled);

  // A WHOOP-only race with WHOOP switched off: there is no race to show.
  if (season && hasContest(season) && !tracks.goals && !tracks.whoop) {
    return (
      <>
        <PageBanner src="/banners/stances.webp" position="50% 45%">
          <h1>Contest</h1>
        </PageBanner>
        <main className="page">
          <section className="zone-card">
            <h2>No contest running</h2>
            <p className="note-line">
              The race is scored on WHOOP data, which this forum has switched off. Lock in your goals for the quarter.
            </p>
            <div className="actions-row" style={{ marginTop: "var(--sp-12)" }}>
              <Link href="/goals" className="btn inline">Set your goals</Link>
            </div>
          </section>
        </main>
      </>
    );
  }

  if (!season || !hasContest(season)) {
    return (
      <>
        <PageBanner src="/banners/stances.webp" position="50% 45%">
          <h1>Contest</h1>
        </PageBanner>
        <main className="page">
          <section className="zone-card">
            <h2>{season ? `${season.name} · no contest picked yet` : "No contest running"}</h2>
            <p className="note-line">
              The forum picks the next contest together. Until then, lock in your goals for the quarter.
            </p>
            <div className="actions-row" style={{ marginTop: "var(--sp-12)" }}>
              <Link href="/goals" className="btn inline">Set your goals</Link>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <PageBanner src="/banners/stances.webp" position="50% 45%">
        <h1>Contest</h1>
      </PageBanner>
      <div className={s.bar}>
        <SubTabs items={tabs(forum.timeZone, tracks.goals)} label="Contest" />
      </div>
      {children}
    </>
  );
}
