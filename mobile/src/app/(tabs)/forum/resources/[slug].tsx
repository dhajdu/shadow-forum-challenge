import { Redirect, useLocalSearchParams } from "expo-router";
import { ConstitutionView } from "@/components/Constitution";
import { Markdown } from "@/components/Markdown";
import { SampleNote } from "@/components/SampleNote";
import { Banner, Display, Empty, Loading, Screen, Small } from "@/components/ui";
import * as data from "@/data";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /forum/resources/[slug] — one document as Markdown; the Constitution shows its signing view.
export default function ResourcePage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: doc, error, loading } = useLoad(() => (slug === "constitution" ? Promise.resolve(null) : data.libraryDoc(slug)), [slug]);
  if (slug === "resources") return <Redirect href="/forum/resources" />;
  if (slug === "expense-sheet") return <Redirect href="/forum/kitty" />;
  if (slug === "constitution")
    return (
      <Screen banner="back" back="Resources" title="Constitution">
        <ConstitutionView />
      </Screen>
    );
  return (
    <Screen banner="back" back="Resources">
      <SampleNote />
      {loading && !doc ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {!loading && !error && !doc ? <Empty>Nothing here.</Empty> : null}
      {doc ? (
        <>
          <Display size={40}>{doc.title}</Display>
          {doc.body_md ? <Markdown text={doc.body_md} /> : <Small>This document has no text.</Small>}
        </>
      ) : null}
    </Screen>
  );
}
