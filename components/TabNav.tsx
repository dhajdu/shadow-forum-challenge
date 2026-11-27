"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Tab = { href: string; label: string; icon: React.ReactNode };

const svg = (d: React.ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {d}
  </svg>
);

export const TABS: Tab[] = [
  { href: "/", label: "Home", icon: svg(<path d="M3 11 12 4l9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />) },
  {
    href: "/forum",
    label: "Forum",
    icon: svg(<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>),
  },
  {
    href: "/contest",
    label: "Contest",
    icon: svg(<><path d="M7 4h10v5a5 5 0 0 1-10 0z" /><path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8" /></>),
  },
  { href: "/ask", label: "Ask", icon: svg(<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />) },
  {
    href: "/me",
    label: "Me",
    icon: svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
  },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

/** The five sections: a left sidebar on desktop, a bottom tab bar on phones (CSS decides). */
export function TabNav({ variant }: { variant: "side" | "bottom" }) {
  const pathname = usePathname();
  return (
    <nav className={variant === "side" ? "side-tabs" : "tabbar"} aria-label="Sections">
      {TABS.map((t) => {
        const on = isActive(pathname, t.href);
        return (
          <Link key={t.href} href={t.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            {t.icon}
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Segmented sub-navigation inside a section (Forum: Agendas · Dates · Library). */
export function SubTabs({ items, label }: { items: { href: string; label: string }[]; label: string }) {
  const pathname = usePathname();
  // the most specific matching tab wins, so /forum/2026-11-25 lights Agendas but /forum/dates lights Dates
  const active = items
    .filter((it) => isActive(pathname, it.href))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
  return (
    <nav className="seg subtabs" aria-label={label}>
      {items.map((it) => {
        const on = it.href === active;
        return (
          <Link key={it.href} href={it.href} className={`seg-btn ${on ? "on" : ""}`} aria-current={on ? "page" : undefined}>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
