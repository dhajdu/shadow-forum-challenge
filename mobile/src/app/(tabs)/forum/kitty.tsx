import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { today } from "@shared/contest";
import { meetingTitle } from "@shared/forum";
import { CATEGORY_LABEL, IN_CATEGORIES, OUT_CATEGORIES, parseVnd, vndFull, vndShort, type KittyCategory } from "@shared/kitty";
import { ForumScreen } from "@/components/ForumScreen";
import { Picker } from "@/components/Picker";
import { Banner, Button, Display, Eyebrow, Field, Loading, Row, Seg, Small } from "@/components/ui";
import * as data from "@/data";

import { short } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, font, fs, radius, space } from "@/theme/tokens";

// /forum/kitty — the forum's own ledger, all year. Any member can add or void a line; voided lines
// stay, struck through. Lines from before the member's first forum fold into "Brought forward".
export default function Kitty() {
  const { data: d, error, loading, reload } = useLoad(async () => {
    const [k, ppl, list, me] = await Promise.all([data.kitty(), data.people(), data.forums(), data.myProfile()]);
    return { k, ppl, list, me };
  });
  const [adding, setAdding] = useState(false);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const who = (id: string | null) => (id ? (d?.ppl.get(id)?.full_name ?? "Member") : null);

  async function doVoid(id: string) {
    setErr(null);
    try {
      await data.voidKittyLine(id);
      setVoiding(null);
      reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  const k = d?.k;
  const totalIn = k?.entries.filter((e) => !e.voided_at && e.direction === "in").reduce((t, e) => t + e.amount_vnd, 0) ?? 0;
  const totalOut = k?.entries.filter((e) => !e.voided_at && e.direction === "out").reduce((t, e) => t + e.amount_vnd, 0) ?? 0;

  return (
    <ForumScreen banner="kitty">
      {loading && !d ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {k && d ? (
        <>
          <View style={{ gap: 4 }}>
            <Eyebrow>In the kitty</Eyebrow>
            <Display size={64}>{`₫${vndShort(k.balance)}`}</Display>
            <Small>{vndFull(k.balance)}</Small>
            <Small tone={color.inkSoft}>{k.treasurer ? `Held by ${k.treasurer}, treasurer` : "No treasurer set"} · dues ₫{vndShort(k.dues)} per forum</Small>
          </View>
          {k.duesFor ? (
            <View style={{ gap: 6 }}>
              <Eyebrow>{`Dues · ${short(k.duesFor.meeting.held_on)}`}</Eyebrow>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {k.duesFor.members.map((m) => (
                  <Text key={m.id} style={{ color: m.paid ? color.green : color.muted, fontFamily: font.semi, fontSize: fs.sm }}>
                    {m.paid ? "✓" : "·"} {m.name.split(" ")[0]}
                  </Text>
                ))}
              </View>
              <Small>{k.duesFor.members.filter((m) => !m.paid).length} of {k.duesFor.members.length} still to pay</Small>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <View>
              <Eyebrow>{`Ledger · ${k.entries.length} lines`}</Eyebrow>
              <Small>In ₫{vndShort(totalIn)} · out ₫{vndShort(totalOut)}</Small>
            </View>
            <Button small label="+ Add a line" onPress={() => setAdding(true)} />
          </View>
          {err ? <Banner tone={color.red}>{err}</Banner> : null}
          {k.entries.map((e) => {
            const m = e.meeting_id ? d.list.find((x) => x.id === e.meeting_id) : null;
            const dead = !!e.voided_at;
            return (
              <View key={e.id}>
                <Row
                  title={<Text style={{ color: dead ? color.muted : color.ink, fontFamily: font.semi, fontSize: fs.base, textDecorationLine: dead ? "line-through" : "none" }}>{CATEGORY_LABEL[e.category]}{e.member_id ? ` · ${who(e.member_id)}` : ""}</Text>}
                  detail={[short(e.entry_on), m ? meetingTitle(m) : null, e.note, dead ? `voided by ${who(e.voided_by)}` : `added by ${who(e.created_by)}`].filter(Boolean).join(" · ")}
                  right={
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ color: dead ? color.muted : e.direction === "in" ? color.green : color.red, fontFamily: font.bold, fontSize: fs.md, fontVariant: ["tabular-nums"] }}>
                        {e.direction === "in" ? "+" : "−"}
                        {vndShort(e.amount_vnd)}
                      </Text>
                      <Small>{vndShort(e.running)}</Small>
                    </View>
                  }
                  onLongPress={dead ? undefined : () => setVoiding(e.id)}
                />
                {voiding === e.id ? (
                  <View style={{ flexDirection: "row", gap: 8, paddingVertical: 8 }}>
                    <Button small danger label="Void this line" onPress={() => doVoid(e.id)} />
                    <Button small ghost label="Keep" onPress={() => setVoiding(null)} />
                  </View>
                ) : null}
              </View>
            );
          })}
          {k.broughtForward ? <Row title="Brought forward from before your first forum" right={vndShort(k.broughtForward)} /> : null}
          <Small>Press and hold a line to void it.</Small>
          {adding ? (
            <AddLine
              dues={k.dues}
              forums={d.list.filter((m) => m.held_on <= today()).slice(0, 12)}
              people={[...d.ppl.values()].sort((a, b) => a.full_name.localeCompare(b.full_name))}
              meId={d.me.id}
              onClose={(changed) => {
                setAdding(false);
                if (changed) reload();
              }}
            />
          ) : null}
        </>
      ) : null}
    </ForumScreen>
  );
}

function AddLine({ dues, forums, people, meId, onClose }: { dues: number; forums: data.ForumListItem[]; people: data.Person[]; meId: string; onClose: (changed: boolean) => void }) {
  const insets = useSafeAreaInsets();
  const [dir, setDir] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState(vndShort(dues));
  const [cat, setCat] = useState<KittyCategory>("dues");
  const [member, setMember] = useState<string>(meId);
  const [meeting, setMeeting] = useState<string>(forums[0]?.id ?? "none");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const cats = dir === "in" ? IN_CATEGORIES : OUT_CATEGORIES;
  const value = parseVnd(amount);
  const ok = value != null && (dir === "in" || note.trim().length > 0);

  async function save() {
    if (!ok) return;
    setBusy(true);
    setErr(null);
    try {
      const m = forums.find((x) => x.id === meeting);
      await data.addKittyLine({
        direction: dir,
        amount_vnd: value!,
        category: cat,
        member_id: member === "none" ? null : member,
        meeting_id: m?.id ?? null,
        entry_on: m?.held_on ?? today(),
        note: note.trim() || null,
      });
      onClose(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <Modal transparent animationType="slide" onRequestClose={() => onClose(false)}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable style={{ flex: 1, backgroundColor: color.scrim }} onPress={() => onClose(false)} />
        <View style={{ backgroundColor: color.popover, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, maxHeight: "88%" }}>
          <ScrollView contentContainerStyle={{ padding: space.page, paddingBottom: insets.bottom + 16, gap: 10 }} keyboardShouldPersistTaps="handled">
            <Text style={{ fontFamily: font.display, fontSize: fs.xl2, color: color.ink }}>ADD TO THE LEDGER</Text>
            <Seg
              options={[{ key: "in", label: "Money in" }, { key: "out", label: "Money out" }] as const}
              value={dir}
              onChange={(v) => {
                setDir(v);
                setCat(v === "in" ? "dues" : "after_forum");
                if (v === "out") setAmount("");
              }}
            />
            <Field label="Amount (2.5M, 750k)" value={amount} onChangeText={setAmount} keyboardType="default" autoCapitalize="none" />
            {amount && value == null ? <Small tone={color.red}>That amount doesn't read as VND.</Small> : value ? <Small>{vndFull(value)}</Small> : null}
            <Eyebrow>Category</Eyebrow>
            <Picker wrap options={cats.map((c) => ({ key: c, label: CATEGORY_LABEL[c] }))} value={cat} onChange={setCat} />
            <Eyebrow>{dir === "in" ? "Paid by" : "Paid to"}</Eyebrow>
            <Picker options={[...people.map((p) => ({ key: p.id, label: p.full_name })), { key: "none", label: "Not a member" }]} value={member} onChange={setMember} />
            <Eyebrow>Forum</Eyebrow>
            <Picker options={[...forums.map((m) => ({ key: m.id, label: `${short(m.held_on)} · ${meetingTitle(m)}` })), { key: "none", label: "Not a forum (today)" }]} value={meeting} onChange={setMeeting} />
            <Field label={dir === "out" ? "Note (required)" : "Note"} value={note} onChangeText={setNote} />
            {err ? <Banner tone={color.red}>{err}</Banner> : null}
            <Button label="Add line" onPress={save} busy={busy} disabled={!ok} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

