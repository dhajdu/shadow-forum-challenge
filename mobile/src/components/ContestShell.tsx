// The Contest tab's frame: banner, title, section tabs and the season gate.
// The season list is what the database returned: a member who joined after the season sees none,
// and the tab opens on Goals and Rules instead of an empty board.
import { router } from "expo-router";
import type { ReactNode } from "react";
import type { Season } from "@shared/forum";
import { CONTEST_NAV, SubNav } from "@/components/SubNav";
import { Banner, Body, Button, Display, Loading, Screen, Small, type BannerName } from "@/components/ui";
import * as data from "@/data";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

export function ContestShell({ children, banner = "stances", gate = true }: { children: (season: Season | null) => ReactNode; banner?: BannerName; gate?: boolean }) {
  const { data: seasons, error, loading } = useLoad(() => data.seasons());
  const season = seasons?.[0] ?? null;
  const frame = (body: ReactNode) => (
    <Screen banner={banner} title="Contest" tabs={<SubNav items={CONTEST_NAV} />}>
      {season ? <Small tone={color.inkSoft}>{season.name}</Small> : null}
      {body}
    </Screen>
  );
  if (loading && !seasons) return frame(<Loading />);
  if (error) return frame(<Banner tone={color.red}>{error}</Banner>);
  if (!season && gate)
    return frame(
      <>
        <Display size={36}>No contest running</Display>
        <Body muted>The next season starts in January. You'll be in it from day one. Connect WHOOP in Me to be ready.</Body>
        <Button label="Set your goals" onPress={() => router.replace("/contest/goals")} />
      </>,
    );
  return frame(children(season));
}
