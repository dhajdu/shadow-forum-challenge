import { getForumContext } from "@/app/_data/context";
import { listSeasons } from "@/app/_data/forum";
import Link from "next/link";
import { SubTabs } from "@/components/TabNav";
import { hasContest, seasonForDay } from "@/lib/contest";
import { PageBanner } from "@/components/PageBanner";
import s from "./contest.module.css";

const tabs = () => [
  { href: "/contest", label: "Race" },
  { href: "/contest/kitty", label: "Kitty" },
  { href: "/contest/rules", label: "Rules" },
  {
    href: `/contest/report/${new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).slice(0, 7)}`,
    label: "Report",
  },
];

// The race, rider, goal, rules and report pages keep their logic; this adds the sub-tabs.
// A member with no season they can see gets the next-season card instead of the pages.
export default async function ContestLayout({ children }: { children: React.ReactNode }) {
  const { db, viewer } = await getForumContext();
  const seasons = await listSeasons(db, viewer);
  const season = seasonForDay(seasons); // today's season: Q4 2026 until Q1 2027 starts

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
        <SubTabs items={tabs()} label="Contest" />
      </div>
      {children}
    </>
  );
}
