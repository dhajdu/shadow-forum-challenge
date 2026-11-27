import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { meetingTitle } from "@shared/forum";
import { AddToCalendar } from "@/components/AddToCalendar";
import { Head } from "@/components/Head";
import { Markdown } from "@/components/Markdown";
import { SampleNote } from "@/components/SampleNote";
import { Banner, Body, Button, Card, Empty, Eyebrow, Loading, Screen } from "@/components/ui";
import * as data from "@/data";
import { stamp, time } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, fs } from "@/theme/tokens";

// /forum/2026-11-25 (same path as the website, so Universal Links land here). Push links may carry the meeting id.
export default function Agenda() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: d, error, loading } = useLoad(() => data.meeting(date), [date]);

  return (
    <Screen>
      <Head back="Forum" />
      <SampleNote />
      {loading && !d ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {/* Not found and not allowed look the same: no hint that anything exists. */}
      {!loading && !error && !d ? <Empty>No forum on this date.</Empty> : null}
      {d ? (
        <>
          <Eyebrow>
            {[stamp(d.meeting.held_on), d.meeting.starts_at ? time(d.meeting.starts_at).toUpperCase() : null, d.meeting.place?.toUpperCase()]
              .filter(Boolean)
              .join(" · ")}
          </Eyebrow>
          <Text style={{ fontSize: fs.xl3, fontWeight: "800", color: color.ink }}>{meetingTitle(d.meeting)}</Text>
          {d.meeting.status === "planned" ? (
            <Card title="Planned">
              <Body muted>The agenda is added after the forum.</Body>
              <AddToCalendar meeting={d.meeting} />
            </Card>
          ) : (
            <Card title="Agenda">{d.doc ? <Markdown text={d.doc.body_md} /> : <Body muted>The agenda isn't in yet.</Body>}</Card>
          )}
          {d.meeting.status === "held" ? (
            <View style={{ gap: 10 }}>
              <Button
                label="Ask about this forum"
                onPress={() => router.navigate({ pathname: "/ask", params: { meeting: d.meeting.id, on: d.meeting.held_on } })}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
