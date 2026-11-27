import { View } from "react-native";
import { COACH_SHARE_PENALTY, CONTEST_END_DAY, CONTEST_START_DAY, FORMULA, MISSED_GOAL_PENALTY, ordinal, PLACEMENT_PENALTIES, STALE_DAYS } from "@shared/contest";
import { ContestShell } from "@/components/ContestShell";
import { Body, Card, Row } from "@/components/ui";
import { long } from "@/lib/format";
import { color, fs } from "@/theme/tokens";

// /contest/rules — the rules as agreed (same text as the iOS app and the website).
export default function RulesPage() {
  return (
    <ContestShell>
      {(season) => (
        <>
          <Body muted>{season.name} · agreed by the five. Amounts in VND.</Body>
          <Card title="1 · Business goal">
            <Body>
              Each rider commits to one business goal for the season. Hit it and you pay nothing. Miss it and {MISSED_GOAL_PENALTY}M VND is owed by the rider and another{" "}
              {COACH_SHARE_PENALTY}M VND by their coach: skin in the game on both sides of the 1-on-1.
            </Body>
          </Card>
          <Card title="2 · Race Into the Shadow">
            <Body>
              Final standings rank on your average daily WHOOP score, a blend of Recovery, Sleep performance and Strain. Only days from the contest start count. A day scores once WHOOP has
              recorded all three numbers; your newest day counts with what it has and is updated on your next upload.
            </Body>
            <Body muted style={{ fontSize: fs.sm }}>
              {FORMULA}
            </Body>
            <View style={{ gap: 6 }}>
              {PLACEMENT_PENALTIES.map((amt, i) => (
                <Row
                  key={i}
                  title={`${ordinal(i + 1)}${i === 0 ? " (winner)" : ""}`}
                  right={<Body style={{ color: amt === 0 ? color.amber : color.red, fontWeight: "800" }}>{amt === 0 ? "0" : `${amt}M VND`}</Body>}
                />
              ))}
            </View>
          </Card>
          <Card title="3 · Keep your data current">
            <Body>Connect WHOOP or upload your export regularly. You'll get a weekly nudge. A red ! marks anyone whose newest data is more than {STALE_DAYS} days old.</Body>
          </Card>
          <Card title="4 · The window">
            <Body>
              The race starts {long(CONTEST_START_DAY)} and runs through {long(CONTEST_END_DAY)}, then the kitty settles.
            </Body>
          </Card>
          <Card title="5 · Monthly coaching call">
            <Body>It's the coach's responsibility to schedule the monthly 1-on-1 call with their rider: a live rep at high-performance coaching.</Body>
          </Card>
        </>
      )}
    </ContestShell>
  );
}
