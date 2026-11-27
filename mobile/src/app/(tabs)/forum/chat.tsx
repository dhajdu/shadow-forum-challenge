import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SampleNote } from "@/components/SampleNote";
import { FORUM_NAV, SubNav } from "@/components/SubNav";
import { Banner, Button, Empty, Field, Header, Loading, Screen } from "@/components/ui";
import * as data from "@/data";
import type { ForumMessage } from "@/data";
import { short, time } from "@/lib/format";
import { refreshUnread } from "@/lib/unread";
import { useLoad } from "@/lib/useLoad";
import { color, fs, radius, space } from "@/theme/tokens";

const MAX = 4000;
const preview = (m: ForumMessage | undefined) =>
  !m ? "Earlier message" : m.deleted_at ? "Deleted message" : m.body.slice(0, 80) || "Photo";

// /forum/chat — one group chat for the whole forum. The database shows messages from the
// member's first forum on; the app never filters. Tap a message for Reply, Edit or Delete.
export default function Chat() {
  const { data: d, error, loading, reload } = useLoad(async () => {
    const [me, messages] = await Promise.all([data.myProfile(), data.chatMessages()]);
    return { me, messages };
  });
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ForumMessage | null>(null);
  const [editing, setEditing] = useState<ForumMessage | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const list = useRef<FlatList<ForumMessage>>(null);

  useEffect(() => data.onChatChange(reload), [reload]);

  // Opening the chat (and every refresh while it is open) marks it read.
  const markRead = useCallback(() => {
    data.markChatRead().then(refreshUnread, () => {});
  }, []);
  useFocusEffect(markRead);
  useEffect(() => {
    if (d) markRead();
  }, [d, markRead]);

  const byId = new Map((d?.messages ?? []).map((m) => [m.id, m]));
  const canDelete = (m: ForumMessage) => !m.deleted_at && (m.author_id === d?.me.id || d?.me.is_admin);
  const canEdit = (m: ForumMessage) => !m.deleted_at && m.author_id === d?.me.id;

  const reset = () => {
    setText("");
    setReplyTo(null);
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
    run(() => (editing ? data.editMessage(editing.id, body) : data.postMessage(body, replyTo?.id ?? null)));
  };

  const select = (m: ForumMessage) => {
    setConfirmDelete(false);
    setSelected(selected === m.id || m.deleted_at ? null : m.id);
  };

  return (
    <Screen scroll={false}>
      <Header title="Forum" />
      <SubNav items={FORUM_NAV} />
      <SampleNote />
      {loading && !d ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {d ? (
        <KeyboardAvoidingView style={{ flex: 1, gap: space.gap }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
          <FlatList
            ref={list}
            style={{ flex: 1 }}
            data={d.messages}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ gap: space.gap, paddingVertical: space.gap }}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={<Empty>No messages yet. Say hello to the forum.</Empty>}
            renderItem={({ item: m, index }) => {
              const mine = m.author_id === d.me.id;
              const prev = d.messages[index - 1];
              const newDay = !prev || prev.created_at.slice(0, 10) !== m.created_at.slice(0, 10);
              const open = selected === m.id;
              return (
                <View>
                  {newDay ? <Text style={st.day}>{short(m.created_at.slice(0, 10))}</Text> : null}
                  <Pressable
                    onPress={() => select(m)}
                    accessibilityRole="button"
                    accessibilityHint="Shows reply, edit and delete"
                    style={[st.bubble, mine ? st.mine : st.theirs, open && { borderColor: color.blueEdge }]}
                  >
                    {!mine ? <Text style={st.author}>{m.author ?? "Member"}</Text> : null}
                    {m.reply_to ? (
                      <Text style={st.quote} numberOfLines={2}>
                        ↳ {byId.get(m.reply_to)?.author ?? ""} {preview(byId.get(m.reply_to))}
                      </Text>
                    ) : null}
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
                  {open ? (
                    <View style={[st.actions, mine ? { alignSelf: "flex-end" } : null]}>
                      <Act label="Reply" onPress={() => {
                          setReplyTo(m);
                          setEditing(null);
                          setSelected(null);
                        }} />
                      {canEdit(m) ? <Act label="Edit" onPress={() => {
                            setEditing(m);
                            setReplyTo(null);
                            setText(m.body);
                            setSelected(null);
                          }} /> : null}
                      {canDelete(m) ? (
                        confirmDelete ? (
                          <Act label="Delete for everyone? Can't be undone" tone={color.red} onPress={() => run(() => data.deleteMessage(m.id))} />
                        ) : (
                          <Act label="Delete" tone={color.red} onPress={() => setConfirmDelete(true)} />
                        )
                      ) : null}
                    </View>
                  ) : null}
                </View>
              );
            }}
          />
          {err ? <Banner tone={color.red}>{err}</Banner> : null}
          {replyTo || editing ? (
            <View style={st.context}>
              <Text style={st.contextText} numberOfLines={1}>
                {editing ? "Editing your message" : `Replying to ${replyTo?.author ?? "member"}: ${preview(replyTo ?? undefined)}`}
              </Text>
              <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel="Cancel" hitSlop={10}>
                <Text style={st.cancel}>✕</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={st.composer}>
            <View style={{ flex: 1 }}>
              <Field placeholder="Message the forum…" value={text} onChangeText={setText} multiline maxLength={MAX} style={{ maxHeight: 120 }} />
            </View>
            <View style={{ width: 84 }}>
              <Button label={editing ? "Save" : "Send"} onPress={send} busy={busy} disabled={!text.trim()} />
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </Screen>
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
  quote: { color: color.muted, fontSize: fs.sm, borderLeftWidth: 2, borderLeftColor: color.blueEdge, paddingLeft: 6 },
  photo: { width: 200, height: 150, borderRadius: radius.md, backgroundColor: color.well },
  body: { color: color.ink, fontSize: fs.base, lineHeight: 20 },
  meta: { color: color.muted, fontSize: fs.xs2, alignSelf: "flex-end" },
  actions: { flexDirection: "row", gap: 6, marginTop: 4, flexWrap: "wrap" },
  act: { borderColor: color.line, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: color.well },
  actText: { fontSize: fs.sm, fontWeight: "700" },
  context: { flexDirection: "row", alignItems: "center", gap: space.gap, backgroundColor: color.well, borderRadius: radius.md, paddingVertical: 6, paddingHorizontal: space.rowX },
  contextText: { flex: 1, color: color.inkSoft, fontSize: fs.sm },
  cancel: { color: color.muted, fontSize: fs.lg },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: space.gap },
});
