import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { addDays, one, placementPenalty, ranked, today } from "@shared/contest";
import { rankDeltas } from "@shared/stats";
import { ContestShell } from "@/components/ContestShell";
import { Banner, Big, Button, Card, Chip, Eyebrow, Loading } from "@/components/ui";
import * as data from "@/data";
import { useLoad } from "@/lib/useLoad";
import { color, fs } from "@/theme/tokens";

const title = (month: string) => new Date(`${month}-15T00:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shift = (month: string, n: number) => addDays(`${month}-15`, n * 30).slice(0, 7);
const delta = (d: number | undefined) => (d == null ? "—" : d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : "–");

// /contest/report/2026-11 — the monthly report: movers since the month began and a per-rider recap.
export default function ReportPage() {
  const { month } = useLocalSearchParams<{ month: string }>();
  return <ContestShell>{() => <Report month={/^\d{4}-\d{2}$/.test(month) ? month : today().slice(0, 7)} />}</ContestShell>;
}

function Report({ month }: { month: string }) {
  const { data: d, error, loading } = useLoad(async () => {
    const [standings, goals, snap] = await Promise.all([data.standings(), data.goalSummaries(), data.snapshotOnOrAfter(`${month}-01`)]);
    const rows = ranked(standings);
    return { rows, goals: new Map(goals.map((g) => [g.user_id, g])), deltas: rankDeltas(rows, snap) };
  }, [month]);

  const nav = (
    <View style={{ flexDirection: "row", gap: 8 }}>
      <View style={{ flex: 1 }}>
        <Button ghost label={`‹ ${title(shift(month, -1)).split(" ")[0]}`} onPress={() => router.setParams({ month: shift(month, -1) })} />
      </View>
      <View style={{ flex: 1 }}>
        <Button ghost label={`${title(shift(month, 1)).split(" ")[0]} ›`} disabled={month >= today().slice(0, 7)} onPress={() => router.setParams({ month: shift(month, 1) })} />
      </View>
    </View>
  );
  if (loading && !d) return <Loading />;
  if (error || !d) return <Banner tone={color.red}>{error ?? "Nothing to show."}</Banner>;
  const movers = d.rows.filter((r) => d.deltas[r.user_id] != null).map((r) => ({ name: r.full_name, delta: d.deltas[r.user_id] }));
  const up = [...movers].sort((a, b) => b.delta - a.delta)[0];
  const down = [...movers].sort((a, b) => a.delta - b.delta)[0];

  return (
    <>
      <Eyebrow>Monthly report</Eyebrow>
      <Text style={{ color: color.ink, fontSize: fs.xl2, fontWeight: "800" }}>{title(month)}</Text>
      {nav}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Card title="Biggest mover" style={{ flex: 1 }}>
          <Big>{up && up.delta > 0 ? `${up.name.split(" ")[0]} ${delta(up.delta)}` : "—"}</Big>
        </Card>
        <Card title="Biggest faller" style={{ flex: 1 }}>
          <Big>{down && down.delta < 0 ? `${down.name.split(" ")[0]} ${delta(down.delta)}` : "—"}</Big>
        </Card>
      </View>
      <Card title="Per-rider recap">
        {d.rows.map((r, i) => {
          const owes = placementPenalty(i);
          const dl = d.deltas[r.user_id];
          return (
            <View key={r.user_id} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 }} accessible>
              <Text style={{ color: color.muted, width: 16, fontVariant: ["tabular-nums"] }}>{i + 1}</Text>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: color.ink, fontWeight: "600", fontSize: fs.base }}>{r.full_name}</Text>
                {d.goals.get(r.user_id) ? <Chip status={d.goals.get(r.user_id)!.current_status} /> : null}
              </View>
              <Text style={{ color: color.ink, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{r.contest_avg > 0 ? one(r.contest_avg) : "—"}</Text>
              <Text style={{ width: 44, textAlign: "right", fontSize: fs.sm, color: (dl ?? 0) > 0 ? color.blue : (dl ?? 0) < 0 ? color.red : color.muted }}>{delta(dl)}</Text>
              <Text style={{ width: 34, textAlign: "right", fontWeight: "800", color: owes === 0 ? color.amber : color.red }}>{owes === 0 ? "0" : `${owes}M`}</Text>
            </View>
          );
        })}
      </Card>
    </>
  );
}
