// Section tabs that are real routes (same paths as the website), drawn as the segmented control.
import { router, usePathname } from "expo-router";
import { Seg } from "./ui";

export function SubNav({ items }: { items: readonly { href: string; label: string; match?: (p: string) => boolean }[] }) {
  const path = usePathname();
  const on = items.find((i) => (i.match ? i.match(path) : path === i.href)) ?? items[0];
  return (
    <Seg
      options={items.map((i) => ({ key: i.href, label: i.label }))}
      value={on.href}
      onChange={(href) => {
        if (href !== path) router.replace(href as never);
      }}
    />
  );
}

export const FORUM_NAV = [
  { href: "/forum", label: "Agendas" },
  { href: "/forum/dates", label: "Dates" },
  { href: "/forum/library", label: "Library" },
  { href: "/forum/chat", label: "Chat" },
] as const;

export const CONTEST_NAV = [
  { href: "/contest", label: "Race" },
  { href: "/contest/goal", label: "My goal" },
  { href: "/contest/kitty", label: "Kitty" },
  { href: "/contest/rules", label: "Rules" },
  { href: "/contest/report", label: "Report", match: (p: string) => p.startsWith("/contest/report") },
] as const;
