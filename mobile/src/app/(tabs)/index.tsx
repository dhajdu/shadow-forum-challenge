import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CONTEST_DAYS, dayOfContest, isStale, one, ordinal, ranked, today } from "@shared/contest";
import { meetingTitle } from "@shared/forum";
import { vndShort } from "@shared/kitty";
import { AddToCalendar } from "@/components/AddToCalendar";
import { SampleNote } from "@/components/SampleNote";
import { Banner, Bar, Body, Chip, Display, Eyebrow, Loading, PageBanner, Row, Small } from "@/components/ui";
import * as data from "@/data";
import { short, time, weekday } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, heroH, space } from "@/theme/tokens";

const greeting = () => {
  const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Ho_Chi_Minh" }));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

// / — one screen answers "when is forum, and how am I doing". A member who joined after the
// season sees a full screen, not an empty one, with no sign anything is hidden.
export default function Home() {
  const insets = useSafeAreaInsets();
  const [pulling, setPulling] = useState(false);
  const { data: d, error, loading, reload } = useLoad(async () => {
    const since = await data.touchLastSeen();
    const [profile, list, seasons, vision, kitty, photos, fresh, personal] = await Promise.all([
      data.myProfile(),
      data.forums(),
      data.seasons(),
      data.vision(),
      data.kitty().catch(() => null),
      data.photos(6).catch(() => []),
      data.newSince(since),
      data.personalGoals().catch(() => []),
    ]);
    const t = today();
    const season = seasons.find((s) => s.starts_on <= t && t <= s.ends_on) ?? null;
    const [standings, goal] = season ? await Promise.all([data.standings(), data.myGoal()]) : [[], null];
    return { profile, list, season, vision, kitty, photos, fresh, personal, standings: ranked(standings), goal };
  });

  if (loading && !d) return <View style={{ flex: 1, backgroundColor: color.bg, paddingTop: insets.top + 80 }}><Loading /></View>;
  if (error || !d) return <View style={{ flex: 1, backgroundColor: color.bg, padding: space.page, paddingTop: insets.top + 40 }}><Banner tone={color.red}>{error ?? "Nothing to show."}</Banner></View>;

  const { profile, list, season, vision, kitty, photos, fresh, personal, standings, goal } = d;
  const t = today();
  const next = list.filter((m) => m.status === "planned" && m.held_on >= t).pop();
  const newest = list.find((m) => m.status === "held" && m.has_agenda);
  const firstForum = next && next.held_on === profile.forum_joined_on;
  const rank = standings.findIndex((r) => r.user_id === profile.id);
  const me = rank >= 0 ? standings[rank] : null;
  const first = profile.full_name.split(" ")[0];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: color.bg }}
      contentContainerStyle={{ paddingBottom: 110 }}
      refreshControl={<RefreshControl refreshing={pulling} tintColor={color.ink} onRefresh={async () => { setPulling(true); await reload(); setPulling(false); }} />}
    >
      <PageBanner image="hero" height={heroH + insets.top} position="50% 30%">
        <Small tone={color.inkSoft}>{`${greeting()}, ${first}`}</Small>
        <Eyebrow tone={color.inkSoft}>{firstForum ? "Your first forum" : "Next forum"}</Eyebrow>
        {next ? (
          <Pressable onPress={() => router.push(`/forum/${next.held_on}`)} accessibilityRole="link">
            <Display size={68}>{weekday(next.held_on)}</Display>
            <Small tone={color.inkSoft}>{[next.starts_at ? time(next.starts_at) : null, next.place ?? "Place to be confirmed"].filter(Boolean).join(" · ")}</Small>
          </Pressable>
        ) : (
          <Display size={56}>Date not set</Display>
        )}
        {next ? <View style={{ flexDirection: "row", marginTop: 8 }}><AddToCalendar meeting={next} small /></View> : null}
      </PageBanner>

      <View style={{ paddingHorizontal: space.page, gap: space.section, paddingTop: 8 }}>
        <SampleNote />
        {vision.is ? (
          <Pressable onPress={() => router.push("/forum/resources/home")} style={{ gap: 4 }}>
            <Eyebrow>The Shadow Forum is…</Eyebrow>
            <Body>{vision.is}</Body>
            <Small tone={color.blue}>Into the Shadow →</Small>
          </Pressable>
        ) : null}

        <View>
          {season ? <Row title={`Your ${season.name} goals`} detail={personal.length ? `${personal.length} goals locked in` : "Lock in your goals"} right="Update" onPress={() => router.push("/contest/goals")} /> : null}
          {kitty ? <Row title="The kitty" detail={kitty.treasurer ? `Held by ${kitty.treasurer.split(" ")[0]}` : "Ledger"} right={`₫${vndShort(kitty.balance)}`} onPress={() => router.push("/forum/kitty")} /> : null}
        </View>

        {season && me ? (
          <Pressable onPress={() => router.navigate("/contest")} style={{ gap: 4 }}>
            <Eyebrow>{`Race into the Shadow · ${season.name}`}</Eyebrow>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
              <Display size={72}>{me.contest_days > 0 ? ordinal(rank + 1) : "—"}</Display>
              <Small style={{ marginBottom: 10 }}>
                of {standings.length} riders · avg {one(me.contest_avg)}
                {"\n"}Day {dayOfContest()} of {CONTEST_DAYS}
              </Small>
            </View>
            <Bar pct={(dayOfContest() / CONTEST_DAYS) * 100} />
            {goal ? (
              <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 6 }}>
                <Small>Your goal {goal.current_progress}%</Small>
                <Chip status={goal.current_status} />
              </View>
            ) : null}
            {isStale(me.last_data_day) ? <Banner>The Whip: no WHOOP data since {me.last_data_day ? short(me.last_data_day) : "the start"}. Open WHOOP to sync.</Banner> : null}
          </Pressable>
        ) : (
          <View>
            <Eyebrow>Start here</Eyebrow>
            <Row title="Read the Constitution" onPress={() => router.push("/forum/resources/constitution")} />
            <Row title="Resources" onPress={() => router.push("/forum/resources")} />
            <Row title="Connect WHOOP for the next season" onPress={() => router.push("/me/biometrics")} />
          </View>
        )}

        {fresh.length ? (
          <View>
            <Eyebrow>New since your last visit</Eyebrow>
            {fresh.map((f) => (
              <Row key={f.path + f.label} title={f.label} onPress={() => router.push(f.path as never)} />
            ))}
          </View>
        ) : null}

        {photos.length ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Eyebrow>Photos</Eyebrow>
              <Pressable onPress={() => router.push("/forum/photos")}>
                <Small tone={color.blue}>See all →</Small>
              </Pressable>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
              {photos.map((p) => (
                <Pressable key={p.id} onPress={() => router.push("/forum/photos")} style={{ width: "32.6%", aspectRatio: 1 }}>
                  <Image source={{ uri: p.thumb ?? undefined }} style={{ flex: 1, backgroundColor: color.avatarFrom }} contentFit="cover" />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {newest ? (
          <View>
            <Eyebrow>Newest agenda</Eyebrow>
            <Row title={`${short(newest.held_on)} · ${meetingTitle(newest)}`} detail={newest.theme} onPress={() => router.push(`/forum/${newest.held_on}`)} />
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}
