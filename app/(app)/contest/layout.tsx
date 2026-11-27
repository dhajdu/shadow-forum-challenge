import { getForumContext } from "@/app/_data/context";
import { listSeasons } from "@/app/_data/forum";
import { SubTabs } from "@/components/TabNav";
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
  const season = seasons[0];

  if (!season) {
    return (
      <main className="page">
        <header className="page-head">
          <div className="eyebrow">Contest</div>
          <h1>Next season</h1>
        </header>
        <section className="zone-card">
          <h2>The next season starts in January</h2>
          <p className="note-line">You&apos;ll be in it from day one. Connect WHOOP in Me so your scores sync from the start.</p>
        </section>
      </main>
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
