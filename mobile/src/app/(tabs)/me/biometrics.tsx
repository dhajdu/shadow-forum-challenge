import { router } from "expo-router";
import { View } from "react-native";
import { journalImpacts } from "@shared/biometrics";
import { one, ordinal, ranked } from "@shared/contest";
import { contestStrip, currentStreak, latestDay, monthly, trends } from "@shared/stats";
import { today } from "@shared/contest";
import { MonthBars } from "@/components/charts";
import { Banner, Card, Kpi, Loading, Row, Screen, Small } from "@/components/ui";
import { Journal, LatestDay, Progress, Trends } from "@/components/zone";
import * as data from "@/data";
import { ago } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

const signed = (n: number) => `${n > 0 ? "+" : ""}${one(n)}`;

// /me/biometrics (web /biometrics) — your own WHOOP numbers only: four stats, the latest day,
// progress, trends, monthly averages, the weekly journal analysis and The numbers.
export default function Biometrics() {
  const { data: d, error, loading } = useLoad(async () => {
    const me = await data.uid();
    const [days, w, standings, analysis, journal, bio] = await Promise.all([
      data.daysOf(me),
      data.whoopStatus(),
      data.standings().catch(() => []),
      data.latestAnalysis(),
      data.journal(90).catch(() => []),
      data.bioDays().catch(() => []),
    ]);
    const rows = ranked(standings);
    return { me, days, w, rank: rows.findIndex((r) => r.user_id === me), analysis, impacts: journalImpacts(journal, bio) };
  });
  if (loading && !d) return <Screen banner="me" back="Me" title="Biometrics"><Loading /></Screen>;
  if (error || !d) return <Screen banner="me" back="Me" title="Biometrics"><Banner tone={color.red}>{error ?? "Nothing to show."}</Banner></Screen>;
  const l = latestDay(d.days);
  const t7 = trends(d.days, "recent")[0];
  const streak = currentStreak(contestStrip(d.days, d.days[0]?.day ?? today(), today()));
  const months = monthly(d.days);

  return (
    <Screen banner="me" back="Me" title="Biometrics">
      <Row
        title={d.w.status === "connected" ? "WHOOP connected" : "WHOOP not connected"}
        detail={d.w.status === "connected" ? `Synced ${d.w.last_sync_at ? ago(d.w.last_sync_at) : "never"}` : "Connect to sync every morning"}
        right="Manage"
        onPress={() => router.push("/me/whoop")}
      />
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Kpi value={l ? one(l.score) : "—"} label={l?.delta != null ? `today · ${signed(l.delta)} vs 30d` : "latest"} />
        <Kpi value={t7?.avg7 != null ? one(t7.avg7) : "—"} label="7-day average" />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Kpi value={d.rank >= 0 ? ordinal(d.rank + 1) : "—"} label="race" />
        <Kpi value={String(streak)} label="day streak" />
      </View>
      <Row title="Ask AI about my biometrics" detail="Reads only your own WHOOP data" onPress={() => router.push({ pathname: "/ask", params: { about: "data" } })} />
      <LatestDay days={d.days} />
      <Progress days={d.days} />
      <Trends days={d.days} />
      {months.length ? (
        <Card title="Monthly averages">
          <MonthBars months={months} />
        </Card>
      ) : null}
      <Journal analysis={d.analysis} />
      <Card title="The numbers">
        {d.impacts.length ? (
          d.impacts.map((i) => (
            <Row
              key={i.question}
              title={i.question}
              detail={`${i.yesDays} of ${i.answered} days · ${i.thisWeek} this week`}
              right={`recovery ${signed(i.recoveryDiff)}${i.sleepDiff != null ? ` · sleep ${signed(i.sleepDiff)}` : ""}`}
            />
          ))
        ) : (
          <Small>Answer the WHOOP journal for a couple of weeks and the effect of each habit shows here.</Small>
        )}
      </Card>
      <Small>Private to you. No one else, admins included, sees this page.</Small>
    </Screen>
  );
}
