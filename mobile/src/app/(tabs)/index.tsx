import { router } from "expo-router";
import { View } from "react-native";
import { CONTEST_DAYS, dayOfContest, isStale, one, ordinal, ranked, today } from "@shared/contest";
import { meetingTitle } from "@shared/forum";
import { AddToCalendar } from "@/components/AddToCalendar";
import { SampleNote } from "@/components/SampleNote";
import { Banner, Big, Body, Card, Chip, Header, Loading, Row, Screen } from "@/components/ui";
import * as data from "@/data";
import { short, time, weekday } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// / — one screen answers "when is forum, and how am I doing". A member who joined after the
// season sees a full screen, not an empty one, with no sign anything is hidden.
export default function Home() {
  const { data: d, error, loading } = useLoad(async () => {
    const [profile, meetings, seasons] = await Promise.all([data.myProfile(), data.meetings(), data.seasons()]);
    const inSeason = seasons.length > 0;
    const [standings, goal] = inSeason ? await Promise.all([data.standings(), data.myGoal()]) : [[], null];
    return { profile, meetings, inSeason, standings: ranked(standings), goal };
  });

  if (loading && !d) return <Screen><Loading /></Screen>;
  if (error || !d) return <Screen><Header title="Home" /><Banner tone={color.red}>{error ?? "Nothing to show."}</Banner></Screen>;

  const { profile, meetings, inSeason, standings, goal } = d;
  const t = today();
  const next = [...meetings].reverse().find((m) => m.held_on >= t);
  const newest = meetings.find((m) => m.status === "held");
  const firstForum = next && next.held_on === profile.forum_joined_on;
  const rank = standings.findIndex((r) => r.user_id === profile.id);
  const me = rank >= 0 ? standings[rank] : null;

  return (
    <Screen>
      <Header title="Home" />
      <SampleNote />

      {next ? (
        <Card title={firstForum ? "Your first forum" : "Next forum"} onPress={() => router.push(`/forum/${next.held_on}`)}>
          <Big>
            {weekday(next.held_on)}
            {next.starts_at ? ` · ${time(next.starts_at)}` : ""}
          </Big>
          <Body muted>{firstForum ? `Welcome to the Shadow, ${profile.full_name}` : [next.place, "set by the moderator"].filter(Boolean).join(" · ")}</Body>
          <AddToCalendar meeting={next} />
        </Card>
      ) : (
        <Card title="Next forum">
          <Body muted>Date not set yet.</Body>
        </Card>
      )}

      {inSeason && me ? (
        <Card title="Race Into the Shadow" onPress={() => router.navigate("/contest")}>
          <Big>{me.contest_days > 0 ? `${ordinal(rank + 1)} of ${standings.length} · avg ${one(me.contest_avg)}` : "Not on the board yet"}</Big>
          <Body muted>
            Day {dayOfContest()} of {CONTEST_DAYS}
          </Body>
        </Card>
      ) : null}

      {inSeason && goal ? (
        <Card title="Your goal" onPress={() => router.navigate("/contest/goal")}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Chip status={goal.current_status} />
            <Big>{goal.current_progress}%</Big>
          </View>
          <Body muted>{goal.title}</Body>
        </Card>
      ) : null}

      {inSeason && me && isStale(me.last_data_day) ? (
        <Banner>The Whip: no WHOOP data since {me.last_data_day ? short(me.last_data_day) : "the start"}. Open WHOOP to sync, or upload in My goal.</Banner>
      ) : null}

      {!inSeason ? (
        <>
          <Card title="Start here">
            <Row title="Read the Constitution" onPress={() => router.navigate("/forum/library/constitution")} />
            <Row title="Resources" onPress={() => router.navigate("/forum/library/resources")} />
            <Row title="Connect WHOOP for next season" onPress={() => router.navigate("/me")} />
          </Card>
          <Card title="Contest">
            <Big>Next season starts in January</Big>
            <Body muted>You'll be in it from day one.</Body>
          </Card>
        </>
      ) : null}

      {newest ? (
        <Card title="Newest agenda">
          <Row title={`${short(newest.held_on)} · ${meetingTitle(newest)}`} onPress={() => router.navigate(`/forum/${newest.held_on}`)} />
        </Card>
      ) : null}
    </Screen>
  );
}
