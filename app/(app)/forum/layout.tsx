import { SubTabs } from "@/components/TabNav";
import { PageBanner } from "@/components/PageBanner";

const TABS = [
  { href: "/forum", label: "Agenda" },
  { href: "/forum/parking", label: "Parking Lot" },
  { href: "/forum/resources", label: "Resources" },
];

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageBanner src="/banners/back.webp" position="50% 40%">
        <h1>Forum</h1>
      </PageBanner>
      <main className="page">
        <SubTabs items={TABS} label="Forum" />
        {children}
      </main>
    </>
  );
}
