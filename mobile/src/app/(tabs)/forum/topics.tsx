import { router } from "expo-router";
import { Pressable } from "react-native";
import { ForumScreen } from "@/components/ForumScreen";
import { TopicList } from "@/components/TopicList";
import { Banner, Loading, Small } from "@/components/ui";
import * as data from "@/data";
import { short } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /forum/topics — topics members asked to bring back (the agenda's Parking Lot), from the newest
// agenda, limited to what was raised from the member's first forum on.
export default function Topics() {
  const { data: d, error, loading } = useLoad(() => data.topics());
  const next = (d?.groups ?? []).flatMap((g) => g.topics).filter((t) => t.nextForum).length;
  return (
    <ForumScreen>
      {loading && !d ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {d ? (
        <>
          <Small>
            Topics members asked to bring back to the forum{next ? ` · ${next} marked for the next forum` : ""}
          </Small>
          {d.asOf ? (
            <Pressable onPress={() => router.push(`/forum/${d.asOf!.held_on}`)}>
              <Small tone={color.blue}>As of the {short(d.asOf.held_on)} agenda ›</Small>
            </Pressable>
          ) : null}
          <TopicList groups={d.groups} />
        </>
      ) : null}
    </ForumScreen>
  );
}
