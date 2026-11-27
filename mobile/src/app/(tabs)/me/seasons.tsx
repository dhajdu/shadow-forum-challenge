import * as WebBrowser from "expo-web-browser";
import { Head } from "@/components/Head";
import { SampleNote } from "@/components/SampleNote";
import { Banner, Body, Button, Empty, Loading, Row, Screen } from "@/components/ui";
import * as data from "@/data";
import { config } from "@/lib/config";
import { long } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /me/seasons (admin). Read-only here; creating a season is on the website.
export default function Seasons() {
  const { data: list, error, loading } = useLoad(() => data.seasons());
  return (
    <Screen>
      <Head back="Me" title="Seasons" />
      <SampleNote />
      {loading && !list ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {list && list.length === 0 ? <Empty>No seasons.</Empty> : null}
      {(list ?? []).map((s) => (
        <Row key={s.id} title={s.name} detail={`${long(s.starts_on)} – ${long(s.ends_on)}${s.metric ? ` · ${s.metric}` : ""}`} />
      ))}
      <Body muted>New seasons are created on the website.</Body>
      <Button ghost label="Open Seasons on the website" onPress={() => WebBrowser.openBrowserAsync(`${config.apiBaseUrl}/me/seasons`)} />
    </Screen>
  );
}
