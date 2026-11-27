import { SubTabs } from "@/components/TabNav";

const TABS = [
  { href: "/forum", label: "Agendas" },
  { href: "/forum/dates", label: "Dates" },
  { href: "/forum/library", label: "Library" },
];

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="page">
      <header className="page-head">
        <div className="eyebrow">The Shadow Forum</div>
        <h1>Forum</h1>
      </header>
      <SubTabs items={TABS} label="Forum" />
      {children}
    </main>
  );
}
