import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { today } from "@shared/contest";
import { meetingTitle } from "@shared/forum";
import { AddToCalendar } from "@/components/AddToCalendar";
import { Markdown } from "@/components/Markdown";
import { TopicList } from "@/components/TopicList";
import { Banner, Body, Button, Card, Display, Empty, Eyebrow, Loading, Row, Screen, Small, Tag } from "@/components/ui";
import * as data from "@/data";
import { stamp, time } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, font, fs, space } from "@/theme/tokens";

const hm = (t: string | null) => (t ? t.slice(0, 5) : "");

// /forum/[date] — a forum: the recap once held, the plan and run sheet while coming.
// A date before the member's first forum comes back as nothing, so it reads "not found".
export default function ForumPage() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { data: d, error, loading } = useLoad(async () => {
    const [f, ppl] = await Promise.all([data.forumDetail(date), data.people()]);
    return { f, ppl };
  }, [date]);
  const [open, setOpen] = useState(0);
  const name = (id: string | null) => (id ? (d?.ppl.get(id)?.full_name ?? "Member") : null);

  if (loading && !d) return <Screen banner="back" back="Forum"><Loading /></Screen>;
  if (error) return <Screen banner="back" back="Forum"><Banner tone={color.red}>{error}</Banner></Screen>;
  if (!d?.f) return <Screen banner="back" back="Forum" title="Forum"><Empty>No forum on this date.</Empty></Screen>;

  const { meeting: m, recap, topics, runSheet, presentations, files } = d.f;
  const coming = m.status === "planned" && m.held_on >= today();
  const total = recap?.sections.reduce((t, s) => t + (s.minutes ?? 0), 0) ?? 0;

  return (
    <Screen banner="back" back="Forum">
      <View style={{ gap: 6 }}>
        <Eyebrow>{coming ? "Coming forum" : "Forum recap"}</Eyebrow>
        <Display size={48} style={{ marginBottom: space.rowGap }}>{coming ? stamp(m.held_on) : meetingTitle(m)}</Display>
        <Small tone={color.inkSoft}>
          {[coming ? meetingTitle(m) : stamp(m.held_on), m.starts_at ? time(m.starts_at) : null, m.place ?? recap?.place ?? "Place to be confirmed", m.host_id ? `host ${name(m.host_id)}` : null].filter(Boolean).join(" · ")}
        </Small>
        {m.address ? <Small>{m.address}</Small> : null}
        {recap?.purpose ? <Body style={{ fontStyle: "italic", marginTop: 4 }}>“{recap.purpose}”</Body> : null}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          <Button small label="Ask about this forum" onPress={() => router.push({ pathname: "/ask", params: { meeting: m.id } })} />
          {coming ? <AddToCalendar meeting={m} small /> : null}
          {files.map((f) => (
            <Button key={f.name} ghost small label={f.name} onPress={() => WebBrowser.openBrowserAsync(f.url)} />
          ))}
        </View>
      </View>

      {coming && m.theme ? (
        <Card title="Theme">
          <Body>{m.theme}</Body>
        </Card>
      ) : null}
      {presentations.length ? (
        <Card title="Presentation">
          {presentations.map((p) => (
            <Row key={p.presenter_id} title={name(p.presenter_id) ?? ""} detail={p.coach_id ? `coach ${name(p.coach_id)}` : null} right={<Tag>{p.kind}</Tag>} />
          ))}
        </Card>
      ) : null}
      {runSheet.length ? (
        <Card title="Run sheet">
          {runSheet.map((l) => (
            <Row
              key={l.position}
              left={<Text style={{ width: 46, color: color.inkSoft, fontFamily: font.semi, fontSize: fs.sm, fontVariant: ["tabular-nums"] }}>{hm(l.starts_at)}</Text>}
              title={l.title}
              detail={[l.owner_id ? name(l.owner_id) : null, l.details].filter(Boolean).join(" · ") || null}
              right={l.minutes ? `${l.minutes}′` : undefined}
            />
          ))}
        </Card>
      ) : null}
      {coming && m.after_activity ? (
        <Card title="After forum">
          <Body>{m.after_activity}</Body>
        </Card>
      ) : null}
      {coming && m.conversation_starters?.length ? (
        <Card title="Conversation starters">
          {m.conversation_starters.map((s, i) => (
            <Body key={i}>· {s}</Body>
          ))}
        </Card>
      ) : null}

      {recap && recap.sections.length ? (
        <Card title={`The forum${total ? ` · ${Math.floor(total / 60)}h ${total % 60}m` : ""}`}>
          {recap.sections.map((s, i) => (
            <View key={i}>
              <Pressable onPress={() => setOpen(open === i ? -1 : i)} accessibilityRole="button" accessibilityState={{ expanded: open === i }}>
                <Row title={`${open === i ? "▾" : "▸"} ${s.title}`} right={s.minutes ? `${s.minutes} min` : undefined} />
              </Pressable>
              {open === i && s.body ? (
                <View style={{ paddingVertical: 8 }}>
                  <Markdown text={s.body} />
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}
      {recap ? (
        <Card title="Topics">
          <TopicList groups={topics} compact />
        </Card>
      ) : null}
      {recap?.learnings.length ? (
        <Card title="Learnings">
          {recap.learnings.map((l, i) => (
            <Body key={i}>
              {i + 1} · {l}
            </Body>
          ))}
        </Card>
      ) : null}
      {!coming && !recap ? <Empty>The agenda for this forum isn't in yet.</Empty> : null}
    </Screen>
  );
}
