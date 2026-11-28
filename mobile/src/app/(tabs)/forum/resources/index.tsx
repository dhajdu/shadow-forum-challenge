import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { ForumScreen } from "@/components/ForumScreen";
import { Banner, Card, Loading, Row, Small, Tag } from "@/components/ui";
import * as data from "@/data";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /forum/resources — the forum's toolkit, as on the website: our documents, the worksheets for
// before and in the room (private files, signed links), then EO links.
type Tool = { path: string; title: string; when: string; what: string; pages: number };
const BEFORE: Tool[] = [
  { path: "reflections-sheet.pdf", title: "5% Reflection worksheet", when: "Every forum", what: "Your monthly update: strongest feelings in work, family and personal life, the next 30 to 60 days, and topics for the Deep Dive.", pages: 1 },
  { path: "deep-dive-worksheet.pdf", title: "Deep Dive: presenter's worksheet", when: "When you present", what: "Headline, context and the questions underneath. Fill it in before your coaching session.", pages: 4 },
];
const ROOM: Tool[] = [
  { path: "communication-starters.pdf", title: "Communication starters", when: "Opening the meeting", what: "Icebreakers that bring everyone into the room.", pages: 6 },
  { path: "lifeline.pdf", title: "Lifeline", when: "Getting to know each other", what: "The highs, lows and turning points of your life, walked through with the forum.", pages: 1 },
  { path: "johari-window.webp", title: "Johari Window", when: "In the room", what: "What you and others know about you, and what nobody knows yet.", pages: 0 },
];
const LINKS = [
  { href: "https://member.eonetwork.org/member/forum/meeting-resources", title: "One EO Hub: forum meeting resources" },
  { href: "https://vimeo.com/1041218191/5fb68ed24d?fl=pl&fe=sh", title: "Forum Mindset Series, Brian Brault" },
  { href: "https://chatgpt.com/g/g-68cfcbdaa600819183d58e994f289bbd-eo-forum-updates", title: "EO Forum Updates (ChatGPT)" },
];

export default function Resources() {
  const { data: docs, error, loading } = useLoad(() => data.resources());
  const [err, setErr] = useState<string | null>(null);
  async function open(t: Tool) {
    setErr(null);
    const url = await data.worksheetUrl(t.path);
    if (url) WebBrowser.openBrowserAsync(url);
    else setErr("That file isn't available right now.");
  }
  const tools = (list: Tool[]) =>
    list.map((t) => (
      <Row key={t.path} title={t.title} detail={`${t.when} · ${t.what}`} right={t.pages ? `PDF · ${t.pages} p` : "Image"} onPress={() => open(t)} />
    ));
  return (
    <ForumScreen>
      {loading && !docs ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {err ? <Banner tone={color.red}>{err}</Banner> : null}
      <Card title="Our forum">
        {(docs ?? []).map((d) => (
          <Row key={d.slug} title={d.title} right={d.audience === "founding" ? <Tag>founding</Tag> : undefined} onPress={() => router.push(`/forum/resources/${d.slug}`)} />
        ))}
        <Row title="Kitty" detail="The forum's ledger" onPress={() => router.replace("/forum/kitty")} />
      </Card>
      <Card title="Before the forum">{tools(BEFORE)}</Card>
      <Card title="In the room">{tools(ROOM)}</Card>
      <Card title="Go deeper">
        {LINKS.map((l) => (
          <Row key={l.href} title={l.title} right="↗" onPress={() => WebBrowser.openBrowserAsync(l.href)} />
        ))}
      </Card>
      <View>
        <Small>Founding-only documents are shown only to founding members.</Small>
      </View>
    </ForumScreen>
  );
}
