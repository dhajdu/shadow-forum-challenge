import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { CONTEST_START_DAY, FORMULA, isStale, one, ordinal, ranked, scoreColor } from "@shared/contest";
import { contestRows } from "@shared/stats";
import { Spark } from "@/components/charts";
import { Head } from "@/components/Head";
import { Banner, Big, Body, Card, Chip, Empty, Header, Kpi, Loading, Screen } from "@/components/ui";
import * as data from "@/data";
import { short } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, fs } from "@/theme/tokens";

// /contest/rider/:id — same path as the website (old /rider/:id redirects here).
export default function Rider() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: d, error, loading } = useLoad(async () => {
    const [standings, goal, days] = await Promise.all([data.standings(), data.goalOf(id), data.daysOf(id)]);
    const list = ranked(standings);
    const rank = list.findIndex((r) => r.user_id === id);
    return { row: rank >= 0 ? list[rank] : null, rank, total: list.length, goal, days };
  }, [id]);

  if (loading && !d) return <Screen><Head back="Contest" /><Loading /></Screen>;
  if (error) return <Screen><Head back="Contest" /><Banner tone={color.red}>{error}</Banner></Screen>;
  // Not found and not allowed look the same.
  if (!d?.row) return <Screen><Head back="Contest" /><Empty>No rider here.</Empty></Screen>;
  const { row, rank, total, goal, days } = d;
  const history = days.slice(-90).map((x) => x.score);
  const rows = contestRows(days);

  return (
    <Screen>
      <Head back="Contest" title={row.full_name.split(" ")[0]} />
      <Header title={row.full_name} />
      <Body muted>
        Rank #{rank + 1} · race avg {one(row.contest_avg)}
      </Body>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Kpi value={ordinal(rank + 1)} label={`of ${total}`} tone={rank === 0 ? color.gold : color.ink} />
        <Kpi value={one(row.contest_avg)} label="Race avg" tone={scoreColor(row.contest_avg)} />
        <Kpi value={String(row.contest_missed)} label="Missed days" tone={row.contest_missed ? color.amber : color.ink} />
      </View>
      {isStale(row.last_data_day) ? <Banner tone={color.red}>No WHOOP data since {row.last_data_day ? short(row.last_data_day) : "the start"}.</Banner> : null}
      {goal ? (
        <Card title="Business goal">
          <Big>{goal.title}</Big>
          <Chip status={goal.current_status} />
        </Card>
      ) : null}
      <Card title="Score history">
        {history.length ? <Spark values={history} height={60} /> : <Body muted>No history yet.</Body>}
        <Body muted style={{ fontSize: fs.xs }}>
          All uploaded history · avg {one(row.all_avg)} over {row.all_days} days
        </Body>
      </Card>
      <Card title="Daily scores · contest">
        <Body muted style={{ fontSize: fs.xs }}>
          {FORMULA}. Race avg = average of scored days since {short(CONTEST_START_DAY)}. The newest day, if still in progress, counts with the numbers it has.
        </Body>
        {rows.length === 0 ? <Empty>No contest days uploaded yet.</Empty> : null}
        {rows.length ? (
          <View style={st.tr}>
            <Text style={[st.th, { flex: 1.4, textAlign: "left" }]}>Day</Text>
            <Text style={st.th}>Rec</Text>
            <Text style={st.th}>Sleep</Text>
            <Text style={st.th}>Strain</Text>
            <Text style={st.th}>Score</Text>
          </View>
        ) : null}
        {rows.map((r) => (
          <View key={r.day} style={st.tr} accessible accessibilityLabel={`${short(r.day)}, ${r.status}${r.data?.score != null ? `, score ${one(r.data.score)}` : ""}`}>
            <Text style={[st.td, { flex: 1.4, textAlign: "left", color: color.inkSoft }]}>{short(r.day)}</Text>
            <Text style={st.td}>{r.data?.recovery != null ? one(r.data.recovery) : "—"}</Text>
            <Text style={st.td}>{r.data?.sleep != null ? one(r.data.sleep) : "—"}</Text>
            <Text style={st.td}>{r.data?.strain != null ? one(r.data.strain) : "—"}</Text>
            <Text style={[st.td, { fontWeight: "800", color: r.status === "missed" ? color.red : scoreColor(r.data?.score ?? 0) }]}>
              {r.status === "missed" ? "missed" : one(r.data?.score ?? 0)}
              {r.status === "in progress" ? "*" : ""}
            </Text>
          </View>
        ))}
        {rows.length ? (
          <View style={[st.tr, { borderBottomWidth: 0 }]}>
            <Text style={[st.td, { flex: 4.4, textAlign: "left" }]}>Race avg · {row.contest_days} days</Text>
            <Text style={[st.td, { fontWeight: "800", color: scoreColor(row.contest_avg) }]}>{one(row.contest_avg)}</Text>
          </View>
        ) : null}
      </Card>
      <Body muted style={{ fontSize: fs.sm }}>
        Coaching notes are seen by the rider, the coach and admins only.
      </Body>
    </Screen>
  );
}

const st = StyleSheet.create({
  tr: { flexDirection: "row", paddingVertical: 5, borderBottomColor: color.line, borderBottomWidth: 1 },
  th: { flex: 1, textAlign: "right", color: color.muted, fontSize: fs.xs, fontWeight: "700" },
  td: { flex: 1, textAlign: "right", color: color.ink, fontSize: fs.sm, fontVariant: ["tabular-nums"] },
});
