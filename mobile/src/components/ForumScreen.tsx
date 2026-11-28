// The Forum tab's frame: banner, FORUM title and the five section tabs (Agenda · Topics · Photos · Kitty · Resources).
import type { ReactNode } from "react";
import type { RefreshControlProps } from "react-native";
import { SampleNote } from "@/components/SampleNote";
import { FORUM_NAV, SubNav } from "@/components/SubNav";
import { Screen, type BannerName } from "@/components/ui";

export function ForumScreen({ children, banner = "back", refresh, right }: { children: ReactNode; banner?: BannerName; refresh?: React.ReactElement<RefreshControlProps>; right?: ReactNode }) {
  return (
    <Screen banner={banner} title="Forum" tabs={<SubNav items={FORUM_NAV} />} refresh={refresh} right={right}>
      <SampleNote />
      {children}
    </Screen>
  );
}
