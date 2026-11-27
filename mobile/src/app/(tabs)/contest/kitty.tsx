import { Text } from "react-native";
import { COACH_SHARE_PENALTY, MISSED_GOAL_PENALTY, ordinal, PLACEMENT_PENALTIES, placementPenalty, ranked } from "@shared/contest";
import { ContestShell } from "@/components/ContestShell";
import { Banner, Big, Body, Card, Chip, Loading, Row } from "@/components/ui";
import * as data from "@/data";
import { useLoad } from "@/lib/useLoad";
import { color, fs } from "@/theme/tokens";

// /contest/kitty — the provisional kitty. On 31 Dec it becomes the settlement.
export default function KittyPage() {
  return <ContestShell>{() => <Kitty />}</ContestShell>;
}

function Kitty() {
  const { data: d, error, loading } = useLoad(async () => {
    const [me, standings, goals] = await Promise.all([data.uid(), data.standings(), data.goalSummaries()]);
    return { me, rows: ranked(standings), goals: new Map(goals.map((g) => [g.user_id, g])) };
  });
  if (loading && !d) return <Loading />;
  if (error || !d) return <Banner tone={color.red}>{error ?? "Nothing to show."}</Banner>;
  const pot = PLACEMENT_PENALTIES.slice(0, d.rows.length).reduce((a, b) => a + b, 0);
  const owes = (n: number) => <Text style={{ color: n === 0 ? color.amber : color.red, fontWeight: "800", fontSize: fs.base, fontVariant: ["tabular-nums"] }}>{n === 0 ? "0" : `${n}M`}</Text>;
  return (
    <>
      <Card title="Provisional kitty">
        <Big tone={color.amber}>{pot}M VND</Big>
        <Body muted>Final on 31 Dec · goals decide up to {MISSED_GOAL_PENALTY + COACH_SHARE_PENALTY}M more per missed goal</Body>
      </Card>
      <Card title="Placement">
        {d.rows.map((r, i) => (
          <Row key={r.user_id} title={`${ordinal(i + 1)} · ${r.user_id === d.me ? "You" : r.full_name}`} right={owes(placementPenalty(i))} />
        ))}
      </Card>
      <Card title="Business goals">
        <Body muted style={{ fontSize: fs.sm }}>
          Settled on 31 Dec: a missed goal costs the rider {MISSED_GOAL_PENALTY}M and their coach {COACH_SHARE_PENALTY}M.
        </Body>
        {d.rows.map((r) => {
          const g = d.goals.get(r.user_id);
          return <Row key={r.user_id} title={r.user_id === d.me ? "You" : r.full_name} detail={g?.title ?? "Goal not set"} right={g ? <Chip status={g.current_status} /> : null} />;
        })}
      </Card>
    </>
  );
}
