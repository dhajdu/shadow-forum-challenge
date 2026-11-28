// The forum chat's message list and composer, shared by the main chat (top-level messages) and a
// thread (its first message, then the replies). Tap a message for Reply, Edit or Delete; press and
// hold someone else's message to Report it or Block its author (App Store guideline 1.2).
import { useRef, useState } from "react";
import { Alert, FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Banner, Button, Empty, Field } from "@/components/ui";
import * as data from "@/data";
import type { ForumMessage } from "@/data";
import { short, time } from "@/lib/format";
import { replyCount } from "@/lib/threads";
import { color, fs, radius, space } from "@/theme/tokens";

const MAX = 4000;

export function ChatRoom({
  me,
  messages,
  replies,
  thread,
  onOpenThread,
  reload,
  placeholder,
  empty,
}: {
  me: { id: string; is_admin: boolean };
  messages: ForumMessage[];
  /** Main chat: the replies under each top-level message, for "N replies · Last 6:00 pm". */
  replies?: Map<string, ForumMessage[]>;
  /** Thread: its first message's id. New messages go into it, and a reply count follows the first message. */
  thread?: string;
  onOpenThread?: (id: string) => void;
  reload: () => Promise<void>;
  placeholder: string;
  empty?: string;
}) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<ForumMessage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const list = useRef<FlatList<ForumMessage>>(null);

  const canDelete = (m: ForumMessage) => !m.deleted_at && (m.author_id === me.id || me.is_admin);
  const canEdit = (m: ForumMessage) => !m.deleted_at && m.author_id === me.id;

  const reset = () => {
    setText("");
    setEditing(null);
    setSelected(null);
    setConfirmDelete(false);
  };

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      reset();
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const send = () => {
    const body = text.trim();
    if (!body) return;
    run(() => (editing ? data.editMessage(editing.id, body) : data.postMessage(body, thread ?? null)));
  };

  const canReport = (m: ForumMessage) => !m.deleted_at && m.author_id !== me.id;

  async function report(m: ForumMessage, block: boolean) {
    try {
      await data.reportMessage(m.id, block);
      Alert.alert("Reported", `The forum's admins will review it within 24 hours.${block ? " You won't see this member's messages any more." : ""}`);
      if (block) await reload();
    } catch (e) {
      Alert.alert("Couldn't report it", e instanceof Error ? e.message : String(e));
    }
  }

  async function block(m: ForumMessage) {
    try {
      await data.blockMember(m.author_id);
      setSelected(null);
      await reload();
    } catch (e) {
      Alert.alert("Couldn't block", e instanceof Error ? e.message : String(e));
    }
  }

  const confirmReport = (m: ForumMessage) =>
    Alert.alert("Report this message?", "The forum's admins get the message and your name, and review it within 24 hours.", [
      { text: "Cancel", style: "cancel" },
      { text: "Report and block", style: "destructive", onPress: () => report(m, true) },
      { text: "Report", onPress: () => report(m, false) },
    ]);

  const confirmBlock = (m: ForumMessage) =>
    Alert.alert(`Block ${m.author ?? "this member"}?`, "You won't see their messages. Unblock them in Me > Account and password.", [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: () => block(m) },
    ]);

  const moderate = (m: ForumMessage) => {
    if (!canReport(m)) return;
    Alert.alert(m.author ?? "Member", undefined, [
      { text: "Report message", style: "destructive", onPress: () => confirmReport(m) },
      { text: `Block ${m.author ?? "member"}`, style: "destructive", onPress: () => confirmBlock(m) },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const select = (m: ForumMessage) => {
    setConfirmDelete(false);
    setSelected(selected === m.id || m.deleted_at ? null : m.id);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, gap: space.gap }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={list}
        style={{ flex: 1 }}
        data={messages}
        keyExtractor={(m) => m.id}
        contentContainerStyle={{ gap: space.gap, paddingVertical: space.gap }}
        onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={empty ? <Empty>{empty}</Empty> : undefined}
        renderItem={({ item: m, index }) => {
          const mine = m.author_id === me.id;
          const prev = messages[index - 1];
          const newDay = !prev || prev.created_at.slice(0, 10) !== m.created_at.slice(0, 10);
          const open = selected === m.id;
          const rs = replies?.get(m.id) ?? [];
          const threadable = !!onOpenThread && !thread;
          return (
            <View>
              {newDay ? <Text style={st.day}>{short(m.created_at.slice(0, 10))}</Text> : null}
              <Pressable
                onPress={() => select(m)}
                onLongPress={() => moderate(m)}
                accessibilityRole="button"
                accessibilityHint={threadable ? "Shows reply, edit and delete. Press and hold to report" : "Shows edit and delete. Press and hold to report"}
                accessibilityActions={canReport(m) ? [{ name: "longpress", label: "Report or block" }] : undefined}
                onAccessibilityAction={(e) => e.nativeEvent.actionName === "longpress" && moderate(m)}
                style={[st.bubble, mine ? st.mine : st.theirs, open && { borderColor: color.blueEdge }]}
              >
                {!mine ? <Text style={st.author}>{m.author ?? "Member"}</Text> : null}
                {m.photo ? <Image source={{ uri: m.photo }} style={st.photo} accessibilityLabel="Gallery photo" /> : null}
                {m.deleted_at ? (
                  <Text style={[st.body, { color: color.muted, fontStyle: "italic" }]}>Message deleted</Text>
                ) : m.body ? (
                  <Text style={st.body} selectable>
                    {m.body}
                  </Text>
                ) : null}
                <Text style={st.meta}>
                  {time(m.created_at)}
                  {m.edited_at && !m.deleted_at ? " · edited" : ""}
                </Text>
              </Pressable>
              {threadable && rs.length > 0 ? (
                <Pressable
                  onPress={() => onOpenThread(m.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${replyCount(rs.length)}, open thread`}
                  style={[st.replies, mine ? { alignSelf: "flex-end" } : null]}
                  hitSlop={6}
                >
                  <Text style={st.repliesText}>
                    {replyCount(rs.length)}
                    <Text style={st.repliesLast}> · Last {time(rs[rs.length - 1].created_at)}</Text>
                  </Text>
                </Pressable>
              ) : null}
              {open ? (
                <View style={[st.actions, mine ? { alignSelf: "flex-end" } : null]}>
                  {threadable ? (
                    <Act
                      label="Reply"
                      onPress={() => {
                        setSelected(null);
                        onOpenThread(m.id);
                      }}
                    />
                  ) : null}
                  {canEdit(m) ? (
                    <Act
                      label="Edit"
                      onPress={() => {
                        setEditing(m);
                        setText(m.body);
                        setSelected(null);
                      }}
                    />
                  ) : null}
                  {canReport(m) ? <Act label="Report" tone={color.red} onPress={() => confirmReport(m)} /> : null}
                  {canReport(m) ? <Act label="Block" tone={color.red} onPress={() => confirmBlock(m)} /> : null}
                  {canDelete(m) ? (
                    confirmDelete ? (
                      <Act label="Delete for everyone? Can't be undone" tone={color.red} onPress={() => run(() => data.deleteMessage(m.id))} />
                    ) : (
                      <Act label="Delete" tone={color.red} onPress={() => setConfirmDelete(true)} />
                    )
                  ) : null}
                </View>
              ) : null}
              {thread && index === 0 ? <Text style={st.count}>{messages.length > 1 ? replyCount(messages.length - 1) : "No replies yet"}</Text> : null}
            </View>
          );
        }}
      />
      {err ? <Banner tone={color.red}>{err}</Banner> : null}
      {editing ? (
        <View style={st.context}>
          <Text style={st.contextText} numberOfLines={1}>
            Editing your message
          </Text>
          <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10}>
            <Text style={st.cancel}>✕</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={st.composer}>
        <View style={{ flex: 1 }}>
          <Field placeholder={placeholder} value={text} onChangeText={setText} multiline maxLength={MAX} style={{ maxHeight: 120 }} />
        </View>
        <View style={{ width: 84 }}>
          <Button label={editing ? "Save" : "Send"} onPress={send} busy={busy} disabled={!text.trim()} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function Act({ label, onPress, tone = color.ink }: { label: string; onPress: () => void; tone?: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={st.act}>
      <Text style={[st.actText, { color: tone }]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  day: { alignSelf: "center", color: color.muted, fontSize: fs.xs, fontWeight: "700", marginVertical: 6 },
  bubble: { maxWidth: "85%", borderRadius: radius.lg, borderWidth: 1, paddingVertical: space.rowY - 2, paddingHorizontal: space.rowX, gap: 4 },
  mine: { alignSelf: "flex-end", backgroundColor: color.navy, borderColor: color.navy },
  theirs: { alignSelf: "flex-start", backgroundColor: color.surface, borderColor: color.line },
  author: { color: color.blue, fontSize: fs.sm, fontWeight: "700" },
  photo: { width: 200, height: 150, borderRadius: radius.md, backgroundColor: color.well },
  body: { color: color.ink, fontSize: fs.base, lineHeight: 20 },
  meta: { color: color.muted, fontSize: fs.xs2, alignSelf: "flex-end" },
  replies: { marginTop: 4, paddingVertical: 2 },
  repliesText: { color: color.blue, fontSize: fs.sm, fontWeight: "700" },
  repliesLast: { color: color.muted, fontWeight: "400" },
  count: { color: color.muted, fontSize: fs.xs, fontWeight: "700", marginTop: space.gap, borderTopWidth: 1, borderTopColor: color.line, paddingTop: space.gap },
  actions: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  act: { borderColor: color.line, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: color.well },
  actText: { fontSize: fs.sm, fontWeight: "700" },
  context: { flexDirection: "row", alignItems: "center", gap: space.gap, backgroundColor: color.well, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: space.rowX },
  contextText: { flex: 1, color: color.inkSoft, fontSize: fs.sm },
  cancel: { color: color.muted, fontSize: fs.lg },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.gap },
});
