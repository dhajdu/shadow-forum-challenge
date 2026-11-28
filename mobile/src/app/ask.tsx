import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Banner, Display, Loading, PageBanner, Row, Small, Tag } from "@/components/ui";
import * as data from "@/data";
import { ask, askAboutData, ApiError, type Cited } from "@/lib/api";
import { long, short } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, font, fs, radius, space } from "@/theme/tokens";

type Msg = { role: "user" | "assistant"; content: string; cited?: Cited[] };
const SUGGEST = ["What did I commit to at the last forum?", "Summarise the newest agenda"];

// /ask — Ask AI, opened from the floating button. Conversations are the member's own (server-side,
// owner-only). It runs as the member, so it only searches agendas they may see, and never hints at
// more. ?meeting=<id|date> scopes it to one forum; ?about=data asks about the member's own WHOOP data.
export default function Ask() {
  const insets = useSafeAreaInsets();
  const { meeting, about } = useLocalSearchParams<{ meeting?: string; about?: string }>();
  const aboutData = about === "data";
  const { data: profile } = useLoad(() => data.myProfile());
  const { data: scopeMeeting } = useLoad(async () => (meeting ? (await data.forumDetail(meeting))?.meeting ?? null : null), [meeting]);
  const [scoped, setScoped] = useState(true);
  const [view, setView] = useState<"chat" | "list">("chat");
  const [convId, setConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const list = useLoad(() => (aboutData ? Promise.resolve([]) : data.conversations()), [view]);

  const scope = scoped && scopeMeeting ? scopeMeeting : null;

  async function openConversation(id: string) {
    setView("chat");
    setConvId(id);
    setMessages([]);
    try {
      const rows = await data.conversation(id);
      setMessages(rows.map((r) => ({ role: r.role, content: r.content })));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function remove(id: string) {
    await data.deleteConversation(id).catch(() => {});
    if (id === convId) fresh();
    list.reload();
  }

  function fresh() {
    setConvId(null);
    setMessages([]);
    setView("chat");
  }

  async function send(text?: string) {
    const q = (text ?? input).trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      if (data.isDemo) {
        setMessages([...next, { role: "assistant", content: "Demo mode: on the live app the assistant answers from the forums you attended, and cites the agenda it used." }]);
      } else if (aboutData) {
        const t = await askAboutData(next, (t) => setMessages([...next, { role: "assistant", content: t }]));
        setMessages([...next, { role: "assistant", content: t }]);
      } else {
        const r = await ask(q, { meetingId: scope?.id ?? null, conversationId: convId ?? "new" }, (t) => setMessages([...next, { role: "assistant", content: t }]));
        setMessages([...next, { role: "assistant", content: r.text, cited: r.cited }]);
        if (r.conversationId) setConvId(r.conversationId);
      }
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "Ask isn't live on the server yet." : e instanceof Error ? e.message : String(e));
      setMessages(next);
    }
    setBusy(false);
  }

  useEffect(() => {
    if (meeting) setScoped(true);
  }, [meeting]);

  return (
    <View style={{ flex: 1, backgroundColor: color.popover }}>
      <PageBanner image="ask" height={130}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <Display size={34}>{aboutData ? "Ask about my data" : "Ask AI"}</Display>
          <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
            <Text style={{ color: color.ink, fontSize: fs.xl }}>✕</Text>
          </Pressable>
        </View>
      </PageBanner>
      {!aboutData ? (
        <View style={st.bar}>
          <Pressable onPress={() => setView(view === "list" ? "chat" : "list")} accessibilityRole="button">
            <Text style={st.link}>{view === "list" ? "‹ Back" : "Conversations"}</Text>
          </Pressable>
          {scope ? (
            <Pressable onPress={() => setScoped(false)} accessibilityRole="button" accessibilityLabel="Ask about all your forums">
              <Tag tone={color.blue}>{`About ${short(scope.held_on)}  ×`}</Tag>
            </Pressable>
          ) : null}
          <Pressable onPress={fresh} accessibilityRole="button">
            <Text style={st.link}>+ New</Text>
          </Pressable>
        </View>
      ) : null}

      {view === "list" ? (
        <ScrollView contentContainerStyle={{ padding: space.page }}>
          {list.loading && !list.data ? <Loading /> : null}
          {list.data && !list.data.length ? <Small>No conversations yet.</Small> : null}
          {(list.data ?? []).map((c) => (
            <Row key={c.id} title={c.title} detail={long(c.updated_at.slice(0, 10))} right={<Pressable onPress={() => remove(c.id)} hitSlop={10} accessibilityLabel="Delete conversation"><Text style={{ color: color.muted, fontSize: fs.lg }}>×</Text></Pressable>} onPress={() => openConversation(c.id)} />
          ))}
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={insets.top + 20}>
          <ScrollView ref={scroll} contentContainerStyle={{ padding: space.page, gap: 10 }} onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })} keyboardShouldPersistTaps="handled">
            {messages.length === 0 ? (
              <>
                <Text style={st.intro}>
                  {aboutData
                    ? "I read only your own WHOOP data: scores, recovery, sleep, strain and your journal."
                    : `I have read only your forums${profile?.forum_joined_on && !profile.is_founding ? `, from ${long(profile.forum_joined_on)}` : ""}.`}
                </Text>
                {!aboutData
                  ? SUGGEST.map((q) => (
                      <Pressable key={q} onPress={() => send(q)} style={st.chip} accessibilityRole="button">
                        <Text style={st.chipText}>{q}</Text>
                      </Pressable>
                    ))
                  : null}
              </>
            ) : null}
            {messages.map((m, i) => (
              <View key={i} style={[st.bubble, m.role === "user" ? st.me : st.bot]}>
                <Text style={st.text} selectable>
                  {m.content || "…"}
                </Text>
                {m.cited?.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      router.back();
                      router.push(`/forum/${c.held_on}`);
                    }}
                    accessibilityRole="link"
                  >
                    <Text style={st.src}>Source: {short(c.held_on)} {c.title ?? "agenda"} ›</Text>
                  </Pressable>
                ))}
              </View>
            ))}
            {error ? <Banner tone={color.red}>{error}</Banner> : null}
          </ScrollView>
          <View style={[st.composer, { paddingBottom: insets.bottom + 10 }]}>
            <TextInput value={input} onChangeText={setInput} placeholder={aboutData ? "Ask about your data…" : "Ask about the forum…"} placeholderTextColor={color.muted} style={st.input} multiline accessibilityLabel="Question" />
            <Pressable onPress={() => send()} disabled={busy || !input.trim()} style={[st.send, (busy || !input.trim()) && { opacity: 0.5 }]} accessibilityRole="button" accessibilityLabel="Send">
              <Text style={{ color: color.white, fontFamily: font.bold, fontSize: fs.lg }}>↑</Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: space.page, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: color.lineSoft },
  link: { color: color.inkSoft, fontFamily: font.semi, fontSize: fs.sm },
  intro: { color: color.muted, fontSize: fs.md, lineHeight: 19, fontFamily: font.body },
  chip: { borderWidth: 1, borderColor: color.line, paddingHorizontal: 12, paddingVertical: 8, alignSelf: "flex-start" },
  chipText: { color: color.inkSoft, fontFamily: font.semi, fontSize: fs.sm },
  bubble: { borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 12, maxWidth: "88%", gap: 6 },
  me: { alignSelf: "flex-end", backgroundColor: color.navy },
  bot: { alignSelf: "flex-start", backgroundColor: color.well, borderColor: color.lineSoft, borderWidth: 1 },
  text: { color: color.ink, fontSize: fs.base, lineHeight: 20, fontFamily: font.body },
  src: { color: color.blue, fontSize: fs.xs, fontFamily: font.bold },
  composer: { flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingTop: 10, borderTopColor: color.lineSoft, borderTopWidth: 1, backgroundColor: color.bg2 },
  input: { flex: 1, color: color.ink, fontSize: fs.lg, fontFamily: font.body, backgroundColor: color.well, borderRadius: radius.md, borderColor: color.line, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, maxHeight: 120 },
  send: { backgroundColor: color.blue, borderRadius: radius.md, width: 46, alignItems: "center", justifyContent: "center" },
});
