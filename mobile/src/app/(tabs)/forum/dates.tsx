import { addDays, today } from "@shared/contest";
import { meetingTitle } from "@shared/forum";
import { AddToCalendar } from "@/components/AddToCalendar";
import { SampleNote } from "@/components/SampleNote";
import { FORUM_NAV, SubNav } from "@/components/SubNav";
import { Banner, Big, Body, Card, Header, Loading, Row, Screen } from "@/components/ui";
import * as data from "@/data";
import { time, weekday } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

const monthName = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });

// /forum/dates — coming dates only. Past forums live in Agendas.
export default function Dates() {
  const { data: meetings, error, loading } = useLoad(() => data.meetings());
  const t = today();
  const coming = (meetings ?? []).filter((m) => m.held_on >= t).reverse();
  const next = coming[0];
  const last = coming[coming.length - 1]?.held_on ?? t;
  const unset = [1, 2].map((i) => monthName(addDays(`${last.slice(0, 7)}-15`, 30 * i)));

  return (
    <Screen>
      <Header title="Forum" />
      <SubNav items={FORUM_NAV} />
      <SampleNote />
      {loading && !meetings ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {meetings ? (
        <>
          {next ? (
            <Card title="Next">
              <Big>
                {weekday(next.held_on)}
                {next.starts_at ? ` · ${time(next.starts_at)}` : ""}
              </Big>
              <Body muted>{[meetingTitle(next), next.place].filter(Boolean).join(" · ")}</Body>
              <AddToCalendar meeting={next} />
            </Card>
          ) : null}
          {coming.slice(1).map((m) => (
            <Row key={m.id} title={`${weekday(m.held_on)}${m.starts_at ? ` · ${time(m.starts_at)}` : ""}`} detail={[meetingTitle(m), m.place].filter(Boolean).join(" · ")} />
          ))}
          {unset.map((mo) => (
            <Row key={mo} title={mo} detail="Date not set yet" />
          ))}
          <Body muted>Past forums are under Agendas.</Body>
          <Row title="Moderator" right={<Body>Dave Hajdu</Body>} />
        </>
      ) : null}
    </Screen>
  );
}
