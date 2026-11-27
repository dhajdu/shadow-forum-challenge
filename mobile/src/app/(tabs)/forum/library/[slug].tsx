import * as WebBrowser from "expo-web-browser";
import { useLocalSearchParams } from "expo-router";
import { Text } from "react-native";
import { Head } from "@/components/Head";
import { Markdown } from "@/components/Markdown";
import { SampleNote } from "@/components/SampleNote";
import { Banner, Body, Button, Card, Empty, Loading, Screen } from "@/components/ui";
import * as data from "@/data";
import { config } from "@/lib/config";
import { useLoad } from "@/lib/useLoad";
import { color, fs } from "@/theme/tokens";

export default function LibraryPage() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data: doc, error, loading } = useLoad(() => data.libraryDoc(slug), [slug]);
  return (
    <Screen>
      <Head back="Library" />
      <SampleNote />
      {loading && !doc ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {!loading && !error && !doc ? <Empty>Nothing here.</Empty> : null}
      {doc ? (
        <>
          <Text style={{ fontSize: fs.xl3, fontWeight: "800", color: color.ink }}>{doc.title}</Text>
          {doc.body_md ? (
            <Card>
              <Markdown text={doc.body_md} />
            </Card>
          ) : null}
          {doc.file_path ? (
            <>
              <Body muted>This page is a file.</Body>
              <Button ghost label="Open on the website" onPress={() => WebBrowser.openBrowserAsync(`${config.apiBaseUrl}/forum/library/${doc.slug}`)} />
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
