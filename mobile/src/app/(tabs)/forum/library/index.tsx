import { router } from "expo-router";
import { SampleNote } from "@/components/SampleNote";
import { FORUM_NAV, SubNav } from "@/components/SubNav";
import { Banner, Empty, Header, Loading, Row, Screen, Tag } from "@/components/ui";
import * as data from "@/data";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /forum/library — undated pages. A page with no audience is shown to no one (by the database).
export default function Library() {
  const { data: docs, error, loading } = useLoad(() => data.library());
  return (
    <Screen>
      <Header title="Forum" />
      <SubNav items={FORUM_NAV} />
      <SampleNote />
      {loading && !docs ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {docs && docs.length === 0 ? <Empty>Nothing here yet.</Empty> : null}
      {(docs ?? []).map((d) => (
        <Row
          key={d.id}
          title={d.title}
          right={d.audience === "founding" ? <Tag>founding</Tag> : null}
          onPress={() => router.push(`/forum/library/${d.slug}`)}
        />
      ))}
    </Screen>
  );
}
