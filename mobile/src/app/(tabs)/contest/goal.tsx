import * as DocumentPicker from "expo-document-picker";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import type { GoalStatus } from "@shared/database.types";
import { one, ordinal, ranked, scoreColor } from "@shared/contest";
import { contestStrip, currentStreak, latestDay, monthly, trends, type Cell, type TrendMode } from "@shared/stats";
import { MonthBars, Spark, Strip } from "@/components/charts";
import { ContestShell } from "@/components/ContestShell";
import { Banner, Bar, Big, Body, Button, Card, Chip, Empty, Eyebrow, Field, Loading, Row, Seg } from "@/components/ui";
import * as data from "@/data";
import { short } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, fs, goalColor, goalLabel, radius } from "@/theme/tokens";

// /contest/goal — My goal (the iOS app's My Zone): business goal, WHOOP progress, extra credit, upload.
export default function GoalPage() {
  return <ContestShell>{() => <MyZone />}</ContestShell>;
}

function MyZone() {
  const { upload } = useLocalSearchParams<{ upload?: string }>();
  const { data: d, error, loading, reload } = useLoad(async () => {
    const me = await data.uid();
    const [standings, days, analysis] = await Promise.all([data.standings(), data.daysOf(me), data.latestAnalysis()]);
    const rows = ranked(standings);
    const rank = rows.findIndex((r) => r.user_id === me);
    return { me, rows, rank, mine: rank >= 0 ? rows[rank] : null, days, analysis };
  });

  if (loading && !d) return <Loading />;
  if (error || !d) return <Banner tone={color.red}>{error ?? "Nothing to show."}</Banner>;
  const { rows, rank, mine, days, analysis } = d;
  const scored = days.filter((x) => x.score != null);
  const allAvg = scored.length ? scored.reduce((a, x) => a + x.score!, 0) / scored.length : null;

  return (
    <>
      <Card title="My zone">
        <Body>
          {mine
            ? `${ordinal(rank + 1)} of ${rows.length} · race avg ${one(mine.contest_avg)} · ${mine.contest_days} scored days · ${mine.contest_missed} missed`
            : "Not on the board yet. Upload your WHOOP export."}
        </Body>
        {allAvg != null ? (
          <Body muted style={{ fontSize: fs.sm }}>
            All time · avg {one(allAvg)} over {scored.length} scored days since {short(scored[0].day)} {scored[0].day.slice(0, 4)}
          </Body>
        ) : null}
      </Card>
      {upload ? <UploadCard onDone={reload} /> : null}
      <GoalCard />
      <LatestDay days={days} />
      <Progress days={days} />
      <Trends days={days} />
      <Card title="Monthly averages">
        {monthly(days).length ? <MonthBars months={monthly(days)} /> : <Body muted>No scored days yet. Upload your WHOOP export.</Body>}
      </Card>
      <Journal analysis={analysis} />
      <ExtraCredit />
      {!upload ? <UploadCard onDone={reload} /> : null}
    </>
  );
}

// ── Business goal ──

const STATUSES = (["on_track", "at_risk", "behind", "hit"] as GoalStatus[]).map((k) => ({ key: k, label: goalLabel[k] }));
const num = (s: string) => (s.trim() === "" ? null : Number(s.replace(",", ".")));

function GoalCard() {
  const { data: goal, error, loading, reload } = useLoad(() => data.myGoal());
  const [editing, setEditing] = useState(false);
  if (loading && goal === undefined) return <Loading />;
  if (error) return <Banner tone={color.red}>{error}</Banner>;
  if (!goal) return <NewGoalCard onDone={reload} />;
  return (
    <Card title={goal.locked ? "Business goal · locked" : "Business goal"}>
      <Big>{goal.title}</Big>
      {goal.coach_name ? <Body muted>Coach: {goal.coach_name}</Body> : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
        <Big tone={goalColor[goal.current_status]}>{goal.current_progress}%</Big>
        <Chip status={goal.current_status} />
        <Text style={{ color: color.muted, fontSize: fs.sm }}>
          {one(goal.current_value)}
          {goal.target_value != null ? ` of ${one(goal.target_value)}` : ""} {goal.unit ?? ""}
        </Text>
      </View>
      <Bar pct={goal.current_progress} tone={goalColor[goal.current_status]} />
      {editing ? (
        <GoalEditor
          goal={goal}
          onDone={() => {
            setEditing(false);
            reload();
          }}
        />
      ) : (
        <Button ghost label="Update progress" onPress={() => setEditing(true)} />
      )}
    </Card>
  );
}

function GoalEditor({ goal, onDone }: { goal: data.Goal; onDone: () => void }) {
  const [status, setStatus] = useState<GoalStatus>(goal.current_status);
  const [value, setValue] = useState(String(goal.current_value));
  const [target, setTarget] = useState(goal.target_value != null ? String(goal.target_value) : "");
  const [unit, setUnit] = useState(goal.unit ?? "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      await data.updateGoal({ currentValue: num(value) ?? 0, targetValue: num(target), unit: unit.trim() || null, status, note: note.trim() || null });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <View style={{ gap: 10, marginTop: 6 }}>
      <Seg options={STATUSES} value={status} onChange={setStatus} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="Current" value={value} onChangeText={setValue} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Target" value={target} onChangeText={setTarget} keyboardType="decimal-pad" editable={!goal.locked} />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Unit" value={unit} onChangeText={setUnit} editable={!goal.locked} />
        </View>
      </View>
      <Field label="Note for your coach" value={note} onChangeText={setNote} multiline style={{ minHeight: 70 }} placeholder="Goes to your coach before the 1-on-1" />
      {err ? <Banner tone={color.red}>{err}</Banner> : null}
      <Button label="Save" onPress={save} busy={busy} />
    </View>
  );
}

function NewGoalCard({ onDone }: { onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setErr(null);
    try {
      if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Date as YYYY-MM-DD.");
      await data.createGoal({ title: title.trim(), targetValue: num(target), unit: unit.trim() || null, targetDate: date || null });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <Card title="Set your business goal">
      <Body muted>One goal for the season. Hit it and you pay nothing. It locks when the season starts.</Body>
      <Field label="Goal" value={title} onChangeText={setTitle} placeholder="Close 3 enterprise deals by 31 Dec" />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Field label="Target" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Unit" value={unit} onChangeText={setUnit} placeholder="deals" />
        </View>
      </View>
      <Field label="By (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-12-31" autoCapitalize="none" />
      {err ? <Banner tone={color.red}>{err}</Banner> : null}
      <Button label="Set goal" onPress={save} busy={busy} disabled={!title.trim()} />
    </Card>
  );
}

// ── WHOOP progress ──

function LatestDay({ days }: { days: data.WhoopDay[] }) {
  const l = latestDay(days);
  return (
    <Card title={l ? `Latest day · ${short(l.day)}` : "Latest day"}>
      {!l ? (
        <Body muted>No scored days yet. Upload your WHOOP export.</Body>
      ) : (
        <>
          <View style={{ flexDirection: "row", alignItems: "baseline", gap: 10 }}>
            <Text style={{ fontSize: 40, fontWeight: "800", color: scoreColor(l.score), fontVariant: ["tabular-nums"] }}>{one(l.score)}</Text>
            {l.delta != null ? (
              <Text style={{ color: l.delta >= 0 ? color.blue : color.red, fontSize: fs.md, fontWeight: "700" }}>
                {l.delta > 0 ? "+" : ""}
                {one(l.delta)} vs your 30-day average
              </Text>
            ) : null}
          </View>
          {l.parts.map((p) => (
            <View key={p.label} style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={st.label}>{p.label}</Text>
                <Text style={st.value}>{p.text}</Text>
              </View>
              <Bar pct={p.pct} tone={scoreColor(p.pct)} />
            </View>
          ))}
          <Body muted style={{ fontSize: fs.sm }}>
            {l.note}
          </Body>
        </>
      )}
    </Card>
  );
}

function Progress({ days }: { days: data.WhoopDay[] }) {
  const cells = contestStrip(days);
  const [picked, setPicked] = useState<Cell | null>(null);
  const scoredN = cells.filter((c) => c.state === "scored").length;
  const missedN = cells.filter((c) => c.state === "missed").length;
  return (
    <Card title="Daily progress">
      <Body muted style={{ fontSize: fs.sm }}>
        {scoredN} scored · {missedN} missed · streak {currentStreak(cells)}
      </Body>
      <Strip cells={cells} onCell={setPicked} />
      {picked ? (
        <Body style={{ fontSize: fs.sm }}>
          {short(picked.day)} · {picked.state === "scored" ? `score ${one(picked.score ?? 0)}` : picked.state === "missed" ? "missed" : "not uploaded yet"}
        </Body>
      ) : null}
    </Card>
  );
}

function Trends({ days }: { days: data.WhoopDay[] }) {
  const [mode, setMode] = useState<TrendMode>("recent");
  const list = trends(days, mode);
  return (
    <Card title={mode === "recent" ? "Trends · last 7 vs 30 days" : "Trends · last 7 days vs all time"}>
      <Seg
        options={[
          { key: "recent", label: "30 days" },
          { key: "all", label: "All time" },
        ]}
        value={mode}
        onChange={setMode}
      />
      {days.length === 0 ? <Body muted>No data yet. Upload your WHOOP export.</Body> : null}
      {days.length
        ? list.map((t) => (
            <View key={t.key} style={st.trend}>
              <Text style={[st.label, { width: 72 }]} numberOfLines={1}>{t.label}</Text>
              <Spark values={t.bars} tone={t.key === "score" ? color.blue : color.inkSoft} />
              <Text style={[st.value, { width: 66, textAlign: "right" }]} numberOfLines={1}>{t.avg7 != null ? `${one(t.avg7)}${t.unit}` : "—"}</Text>
              <Text
                style={[
                  st.value,
                  { width: 40, textAlign: "right", color: t.good == null ? color.muted : t.good ? color.green : color.red },
                ]}
              >
                {t.delta == null ? "—" : `${t.delta > 0 ? "+" : ""}${one(t.delta)}`}
              </Text>
            </View>
          ))
        : null}
    </Card>
  );
}

function Journal({ analysis }: { analysis: data.JournalAnalysis | null }) {
  return (
    <Card title={analysis ? `Journal insights · week of ${short(analysis.week_of)}` : "Journal insights"}>
      {!analysis ? (
        <Body muted>Your weekly analysis arrives Monday. Keep answering the WHOOP journal each morning and upload your export.</Body>
      ) : (
        <>
          <Big>{analysis.headline}</Big>
          {analysis.insights.map((i) => (
            <View key={i.title} style={{ flexDirection: "row", gap: 8 }}>
              <Text style={{ color: i.effect === "helps" ? color.green : i.effect === "hurts" ? color.red : color.amber, fontWeight: "800" }}>
                {i.effect === "helps" ? "▲" : i.effect === "hurts" ? "▼" : "◆"}
              </Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: color.ink, fontWeight: "700", fontSize: fs.base }}>{i.title}</Text>
                <Body muted style={{ fontSize: fs.sm }}>
                  {i.detail}
                </Body>
              </View>
            </View>
          ))}
          <Eyebrow tone={color.amber}>Try this week</Eyebrow>
          <Body>{analysis.suggestion}</Body>
        </>
      )}
    </Card>
  );
}

// ── Extra credit (personal goals, just for you) ──

function ExtraCredit() {
  const { data: goals, error, reload } = useLoad(() => data.personalGoals());
  const [title, setTitle] = useState("");
  const [unit, setUnit] = useState("");
  const [target, setTarget] = useState("");
  const [adding, setAdding] = useState(false);
  const [err, setErr] = useState<string | null>(error);
  useEffect(() => setErr(error), [error]);

  async function run(fn: () => Promise<void>) {
    setErr(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Card title="Extra credit">
      <Body muted style={{ fontSize: fs.sm }}>
        Personal goals, just for you. These don't count toward the contest.
      </Body>
      {(goals ?? []).map((g) => {
        const pct = g.target_value && g.target_value > 0 ? Math.max(0, Math.min(100, Math.round((g.current_value / g.target_value) * 100))) : null;
        return (
          <View key={g.id} style={st.xc}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: color.ink, fontWeight: "600", fontSize: fs.base }}>{g.title}</Text>
              <Text style={st.label}>
                {one(g.current_value)}
                {g.target_value != null ? ` / ${one(g.target_value)}` : ""} {g.unit ?? ""}
                {pct != null ? ` · ${pct}%` : ""}
              </Text>
              {pct != null ? <Bar pct={pct} /> : null}
            </View>
            <Step label="−" onPress={() => run(() => data.updatePersonalGoal(g.id, Math.max(0, g.current_value - 1)))} />
            <Step label="+" onPress={() => run(() => data.updatePersonalGoal(g.id, g.current_value + 1))} />
            <Step
              label="×"
              onPress={() =>
                Alert.alert("Delete this goal?", g.title, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Delete", style: "destructive", onPress: () => run(() => data.deletePersonalGoal(g.id)) },
                ])
              }
            />
          </View>
        );
      })}
      {goals && goals.length === 0 ? <Empty>No personal goals yet.</Empty> : null}
      {adding ? (
        <View style={{ gap: 8 }}>
          <Field label="Goal" value={title} onChangeText={setTitle} placeholder="Read 12 books" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Field label="Target" value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Unit" value={unit} onChangeText={setUnit} />
            </View>
          </View>
          <Button
            label="Add"
            disabled={!title.trim()}
            onPress={() =>
              run(async () => {
                await data.addPersonalGoal(title.trim(), unit.trim() || null, num(target));
                setTitle("");
                setUnit("");
                setTarget("");
                setAdding(false);
              })
            }
          />
        </View>
      ) : (
        <Button ghost label="Add a personal goal" onPress={() => setAdding(true)} />
      )}
      {err ? <Banner tone={color.red}>{err}</Banner> : null}
    </Card>
  );
}

function Step({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={st.step} accessibilityRole="button" accessibilityLabel={label === "+" ? "Add one" : label === "−" ? "Subtract one" : "Delete"}>
      <Text style={{ color: color.ink, fontWeight: "800", fontSize: fs.lg }}>{label}</Text>
    </Pressable>
  );
}

// ── Upload (fallback for riders who don't connect WHOOP) ──

function UploadCard({ onDone }: { onDone: () => void }) {
  const shared = useLocalSearchParams<{ file?: string; name?: string }>();
  const { data: list, reload } = useLoad(() => data.uploads());
  const [stage, setStage] = useState<"uploading" | "processing" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function pick() {
    setMsg(null);
    const res = await DocumentPicker.getDocumentAsync({
      type: ["application/zip", "text/csv", "text/comma-separated-values", "public.zip-archive"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets[0]) return;
    await send({ uri: res.assets[0].uri, name: res.assets[0].name });
  }

  async function send(file: { uri: string; name: string }) {
    setMsg(null);
    try {
      const n = await data.uploadWhoop(file, setStage);
      setMsg({ ok: true, text: `Uploaded. ${n} days ingested.` });
      reload();
      onDone();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setStage(null);
  }

  return (
    <Card title="Upload WHOOP export">
      <Body muted style={{ fontSize: fs.sm }}>
        In the WHOOP app: More → App Settings → Data Export. Pick the .zip or a CSV. You can also share the file to Shadow Forum.
      </Body>
      {shared.file && shared.name ? (
        <Button
          label={stage ? (stage === "uploading" ? "Uploading…" : "Processing…") : `Upload ${shared.name}`}
          busy={stage !== null}
          onPress={() => send({ uri: shared.file!.startsWith("file:") ? shared.file! : `file://${shared.file}`, name: shared.name! })}
        />
      ) : null}
      <Button
        ghost={Boolean(shared.file)}
        label={stage === "uploading" ? "Uploading…" : stage === "processing" ? "Processing…" : "Choose file"}
        onPress={pick}
        busy={stage !== null}
      />
      {msg ? <Banner tone={msg.ok ? color.green : color.red}>{msg.text}</Banner> : null}
      {(list ?? []).slice(0, 5).map((u) => (
        <Row
          key={u.id}
          title={u.file_name}
          detail={`${short(u.created_at.slice(0, 10))} · ${u.status}${u.rows_ingested != null ? ` · ${u.rows_ingested} rows` : ""}`}
        />
      ))}
    </Card>
  );
}

const st = StyleSheet.create({
  label: { color: color.muted, fontSize: fs.sm },
  value: { color: color.ink, fontSize: fs.sm, fontWeight: "700", fontVariant: ["tabular-nums"] },
  trend: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  xc: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: color.wellSoft, borderRadius: radius.md, padding: 10, borderColor: color.line, borderWidth: 1 },
  step: { width: 32, height: 32, borderRadius: radius.sm, alignItems: "center", justifyContent: "center", backgroundColor: color.well, borderColor: color.line, borderWidth: 1 },
});
