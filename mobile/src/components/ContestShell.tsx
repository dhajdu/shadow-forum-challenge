// Header, section tabs and the season gate shared by every Contest page.
// The season list is what the database returned: a member who joined after the season sees none.
import type { ReactNode } from "react";
import type { Season } from "@shared/forum";
import { CONTEST_NAV, SubNav } from "@/components/SubNav";
import { Banner, Big, Body, Card, Header, Loading, Screen, Tag } from "@/components/ui";
import * as data from "@/data";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

export function ContestShell({ children }: { children: (season: Season) => ReactNode }) {
  const { data: seasons, error, loading } = useLoad(() => data.seasons());
  if (loading && !seasons) return <Screen><Header title="Contest" /><Loading /></Screen>;
  if (error) return <Screen><Header title="Contest" /><Banner tone={color.red}>{error}</Banner></Screen>;
  const season = seasons?.[0];
  if (!season) {
    return (
      <Screen>
        <Header title="Contest" />
        <Card title="Contest">
          <Big>Next season starts in January</Big>
          <Body muted>You'll be in it from day one. Connect WHOOP in Me to be ready.</Body>
        </Card>
      </Screen>
    );
  }
  return (
    <Screen>
      <Header title="Contest" right={<Tag tone={color.ink}>{season.name}</Tag>} />
      <SubNav items={CONTEST_NAV} />
      {children(season)}
    </Screen>
  );
}
