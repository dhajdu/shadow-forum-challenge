"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useForumSettings } from "@/components/ForumSettingsProvider";

type Tab = { href: string; label: string; short?: string };

export const TABS: Tab[] = [
  { href: "/", label: "Home" },
  { href: "/forum", label: "Forum" },
  { href: "/gallery", label: "Gallery" },
  { href: "/goals", label: "Goals" },
  { href: "/contest", label: "Contest" },
  { href: "/kitty", label: "Kitty" },
  { href: "/biometrics", label: "Biometrics", short: "Bio" },
  { href: "/ask", label: "Ask AI" },
  { href: "/me", label: "Profile" },
];

export function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
}

/** The sections: a left sidebar on desktop, a bottom tab bar on phones (CSS decides). */
export function TabNav({ variant }: { variant: "side" | "bottom" }) {
  const pathname = usePathname();
  const { whoopEnabled } = useForumSettings();
  const tabs = whoopEnabled ? TABS : TABS.filter((t) => t.href !== "/biometrics");
  return (
    <nav className={variant === "side" ? "side-tabs" : "tabbar"} aria-label="Sections">
      {tabs.map((t) => {
        const on = isActive(pathname, t.href);
        return (
          <Link key={t.href} href={t.href} className={on ? "on" : ""} aria-current={on ? "page" : undefined}>
            {variant === "bottom" && t.short ? t.short : t.label}
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
