import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Banner, Header, Tag } from "@/components/ui";
import * as data from "@/data";
import { ask, askHistory, ApiError, type Cited } from "@/lib/api";
import { long, short } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, fs, radius, space } from "@/theme/tokens";

type Msg = { role: "user" | "assistant"; content: string; cited?: Cited[] };

// /ask — the forum assistant. It runs on the server as the member (their token), so it only
// searches agendas they may see. With no match it says it has no record, and never hints at more.
export default function Ask() {
  const { meeting, on } = useLocalSearchParams<{ meeting?: string; on?: string }>();
  const { data: profile } = useLoad(() => data.myProfile());
  const [scope, setScope] = useState<{ id: string; on: string } | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    if (meeting && on) setScope({ id: meeting, on });
  }, [meeting, on]);

  // The member's own history (owner-only on the server).
  useEffect(() => {
    if (data.isDemo) return;
    askHistory()
      .then((rows) => setMessages((m) => (m.length ? m : rows.map((r) => ({ role: r.role, content: r.content })))))
      .catch(() => {});
  }, []);

  async function send() {
    const q = input.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      if (data.isDemo) {
        const reply = scope
          ? `Demo mode: on the live app this answers from the ${short(scope.on)} agenda only, and cites it.`
          : "Demo mode: on the live app the assistant answers from the forums you attended and your own contest data, and cites the agenda it used.";
        setMessages([...next, { role: "assistant", content: reply }]);
      } else {
        const { text, cited } = await ask(q, scope?.id ?? null, (t) => setMessages([...next, { role: "assistant", content: t }]));
        setMessages([...next, { role: "assistant", content: text, cited }]);
      }
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? "Ask isn't live on the server yet." : e instanceof Error ? e.message : String(e));
      setMessages(next);
    }
    setBusy(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.bg }} edges={["top"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={80}>
        <View style={{ paddingHorizontal: space.page, paddingTop: space.page, gap: 10 }}>
          <Header title="Ask" />
          {scope ? (
            <Pressable onPress={() => setScope(null)} accessibilityRole="button" accessibilityLabel="Ask about all your forums">
              <Tag tone={color.blue}>{`About the ${short(scope.on)} forum  ×`}</Tag>
            </Pressable>
          ) : null}
        </View>
        <ScrollView
          ref={scroll}
          contentContainerStyle={{ padding: space.page, gap: 10 }}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
        >
          <Text style={st.intro}>
            I know the forums you attended
            {profile?.forum_joined_on && !profile.is_founding ? `, from ${long(profile.forum_joined_on)}` : ""}, and your own contest data.
          </Text>
          {messages.map((m, i) => (
            <View key={i} style={[st.bubble, m.role === "user" ? st.me : st.bot]}>
              <Text style={st.text} selectable>
                {m.content || "…"}
              </Text>
              {m.cited?.map((c) => (
                <Pressable key={c.id} onPress={() => router.push(`/forum/${c.held_on}`)} accessibilityRole="link">
                  <Text style={st.src}>Source: {short(c.held_on)} {c.title ?? "agenda"} ›</Text>
                </Pressable>
              ))}
            </View>
          ))}
          {error ? <Banner tone={color.red}>{error}</Banner> : null}
        </ScrollView>
        <View style={st.composer}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder="Ask about your forum…"
            placeholderTextColor={color.muted}
            style={st.input}
            multiline
            onSubmitEditing={send}
            accessibilityLabel="Question"
          />
          <Pressable
            onPress={send}
            disabled={busy || !input.trim()}
            style={[st.send, (busy || !input.trim()) && { opacity: 0.5 }]}
            accessibilityRole="button"
            accessibilityLabel="Send"
          >
            <Text style={{ color: color.white, fontWeight: "700", fontSize: fs.md }}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  intro: { color: color.muted, fontSize: fs.md, lineHeight: 19 },
  bubble: { borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: 12, maxWidth: "88%", gap: 6 },
  me: { alignSelf: "flex-end", backgroundColor: color.navy },
  bot: { alignSelf: "flex-start", backgroundColor: color.surface, borderColor: color.line, borderWidth: 1 },
  text: { color: color.ink, fontSize: fs.base, lineHeight: 20 },
  src: { color: color.blue, fontSize: fs.xs, fontWeight: "700" },
  composer: { flexDirection: "row", gap: 8, padding: 12, borderTopColor: color.line, borderTopWidth: 1, backgroundColor: color.bg2 },
  input: {
    flex: 1,
    color: color.ink,
    fontSize: fs.lg,
    backgroundColor: color.well,
    borderRadius: radius.pill,
    borderColor: color.line,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxHeight: 120,
  },
  send: { backgroundColor: color.blue, borderRadius: radius.pill, paddingHorizontal: 16, justifyContent: "center" },
});
