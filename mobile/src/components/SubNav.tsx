// Section tabs that are real routes (the website's paths), drawn as red-underlined text tabs.
import { router, usePathname } from "expo-router";
import { Tabs } from "./ui";

type Item = { href: string; label: string; match?: (p: string) => boolean };

export function SubNav({ items }: { items: readonly Item[] }) {
  const path = usePathname();
  const on = items.find((i) => (i.match ? i.match(path) : path === i.href)) ?? items[0];
  return (
    <Tabs
      options={items.map((i) => ({ key: i.href, label: i.label }))}
      value={on.href}
      onChange={(href) => {
        if (href !== path) router.replace(href as never);
      }}
    />
  );
}

export const FORUM_NAV: readonly Item[] = [
  { href: "/forum", label: "Agenda" },
  { href: "/forum/topics", label: "Topics" },
  { href: "/forum/photos", label: "Photos" },
  { href: "/forum/kitty", label: "Kitty" },
  { href: "/forum/resources", label: "Resources", match: (p) => p.startsWith("/forum/resources") },
];

export const CONTEST_NAV: readonly Item[] = [
  { href: "/contest", label: "Race" },
  { href: "/contest/goals", label: "Goals" },
  { href: "/contest/kitty", label: "Penalties" },
  { href: "/contest/rules", label: "Rules" },
  { href: "/contest/report", label: "Report", match: (p) => p.startsWith("/contest/report") },
];
