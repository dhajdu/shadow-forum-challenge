import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CONTEST_DAYS, dayOfContest, FORMULA, isStale, one, PLACEMENT_PENALTIES, placementPenalty, ranked, scoreColor } from "@shared/contest";
import { rankDeltas } from "@shared/stats";
import { ContestShell } from "@/components/ContestShell";
import { Banner, Body, Card, Chip, Empty, Kpi, Loading, Row } from "@/components/ui";
import * as data from "@/data";
import { ago, short } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { publishWidget } from "@/lib/widget";
import { color, fs, radius } from "@/theme/tokens";

// /contest — Race Into the Shadow. Highest average WHOOP score leads; deepest into the shadow pays nothing.
export default function RacePage() {
  return <ContestShell>{() => <Race />}</ContestShell>;
}

function Race() {
  const { data: d, error, loading } = useLoad(async () => {
    const [me, standings, goals, snap, whoop] = await Promise.all([
      data.uid(),
      data.standings(),
      data.goalSummaries(),
      data.snapshotBefore(),
      data.whoopStatus(),
    ]);
    const rows = ranked(standings);
    return { me, rows, goals: new Map(goals.map((g) => [g.user_id, g])), snap, deltas: rankDeltas(rows, snap), whoop };
  });

  useEffect(() => {
    if (d) publishWidget(d.rows, d.me);
  }, [d]);

  if (loading && !d) return <Loading />;
  if (error || !d) return <Banner tone={color.red}>{error ?? "Nothing to show."}</Banner>;
  const { me, rows, goals, snap, deltas, whoop } = d;
  const pot = PLACEMENT_PENALTIES.slice(0, rows.length).reduce((a, b) => a + b, 0);
  const scored = rows.filter((r) => r.contest_days > 0);
  const avg = scored.length ? scored.reduce((a, r) => a + r.contest_avg, 0) / scored.length : 0;
  const mover = rows
    .map((r) => ({ name: r.full_name, delta: deltas[r.user_id] ?? 0 }))
    .filter((m) => m.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];

  return (
    <>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Kpi value={`${dayOfContest()}/${CONTEST_DAYS}`} label="Day" />
        <Kpi value={`${pot}M`} label="Kitty so far" tone={color.amber} />
        <Kpi value={scored.length ? one(avg) : "—"} label="Group avg" tone={scored.length ? scoreColor(avg) : color.ink} />
      </View>

      <Card title="This week">
        <Body>
          {!snap
            ? "No weekly snapshot yet. Movers show from the first one."
            : mover
              ? `Biggest mover: ${mover.name} ${mover.delta > 0 ? "▲" : "▼"} ${Math.abs(mover.delta)} since ${short(snap.day)}`
              : `No place changes since ${short(snap.day)}.`}
        </Body>
      </Card>

      <Card title="Race Into the Shadow">
        {rows.length === 0 ? <Empty>No riders yet.</Empty> : null}
        {rows.map((r, i) => {
          const c = r.contest_days ? scoreColor(r.contest_avg) : color.muted;
          const goal = goals.get(r.user_id);
          const owes = placementPenalty(i);
          const delta = deltas[r.user_id];
          return (
            <Pressable
              key={r.user_id}
              onPress={() => router.push(`/contest/rider/${r.user_id}`)}
              accessibilityRole="button"
              accessibilityLabel={`${i + 1}, ${r.full_name}, average ${one(r.contest_avg)}, owes ${owes} million`}
              style={({ pressed }) => [st.row, pressed && { opacity: 0.7 }]}
            >
              <Text style={[st.place, i === 0 && { color: color.gold }]}>{i + 1}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[st.name, r.user_id === me && { color: color.ink }]} numberOfLines={1}>
                    {r.user_id === me ? "You" : r.full_name}
                  </Text>
                  {isStale(r.last_data_day) ? <Text style={st.bang} accessibilityLabel="Upload overdue">!</Text> : null}
                  {delta ? (
                    <Text style={{ color: delta > 0 ? color.blue : color.red, fontSize: fs.xs, fontWeight: "700" }}>
                      {delta > 0 ? `▲${delta}` : `▼${-delta}`}
                    </Text>
                  ) : null}
                </View>
                <View style={st.track}>
                  <View style={[st.runner, { left: `${Math.max(0, Math.min(94, r.contest_avg - 3))}%`, backgroundColor: c, shadowColor: c }]} />
                </View>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                  {goal ? <Chip status={goal.current_status} /> : <Text style={st.meta}>goal not set</Text>}
                  <Text style={st.meta}>
                    {r.contest_days}d · {r.contest_missed} missed
                  </Text>
                </View>
              </View>
              <View style={{ alignItems: "flex-end", width: 50 }}>
                <Text style={[st.score, { color: c }]}>{r.contest_days ? one(r.contest_avg) : "—"}</Text>
                <Text style={[st.owes, { color: owes === 0 ? color.amber : color.red }]}>{owes === 0 ? "0" : `${owes}M`}</Text>
              </View>
            </Pressable>
          );
        })}
        <Body muted style={{ fontSize: fs.xs }}>
          {FORMULA}. 1st pays 0, then 2M–5M VND.
        </Body>
      </Card>

      <Row
        title="WHOOP"
        detail={
          whoop.status === "connected"
            ? `Synced ${whoop.last_sync_at ? ago(whoop.last_sync_at) : "never"}`
            : "Not connected. Connect in Me, or upload an export in My goal."
        }
        right={whoop.status === "connected" ? <Text style={{ color: color.green }}>✓</Text> : null}
        onPress={whoop.status === "connected" ? undefined : () => router.navigate("/me")}
      />
    </>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomColor: color.line, borderBottomWidth: 1 },
  place: { width: 16, color: color.muted, fontSize: fs.md, fontWeight: "800", fontVariant: ["tabular-nums"] },
  name: { color: color.inkSoft, fontSize: fs.base, fontWeight: "700", flexShrink: 1 },
  bang: { color: color.bg, backgroundColor: color.red, fontWeight: "900", fontSize: fs.xs, width: 16, height: 16, borderRadius: 8, textAlign: "center", overflow: "hidden" },
  track: { height: 12, borderRadius: radius.pill, backgroundColor: color.well, borderColor: color.line, borderWidth: 1 },
  runner: { position: "absolute", top: 1, width: 8, height: 8, borderRadius: 4, shadowOpacity: 0.9, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  meta: { color: color.muted, fontSize: fs.xs },
  score: { fontSize: fs.xl, fontWeight: "800", fontVariant: ["tabular-nums"] },
  owes: { fontSize: fs.sm, fontWeight: "800", fontVariant: ["tabular-nums"] },
});
