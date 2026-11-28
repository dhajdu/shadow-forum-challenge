import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { addDays, today } from "@shared/contest";
import { meetingTitle } from "@shared/forum";
import { AddToCalendar } from "@/components/AddToCalendar";
import { ForumScreen } from "@/components/ForumScreen";
import { Banner, Body, Button, DayNum, Display, Empty, Eyebrow, Field, Loading, Row, Small, Tag } from "@/components/ui";
import * as data from "@/data";
import { long, time, weekday } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, space } from "@/theme/tokens";

const monthName = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
const mon = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });

// /forum — Agenda. Coming up first: the next forum fills the top, then months still to be set.
// Past forums below, with search. Older forums are absent, not greyed out: the list is exactly
// what the database returned for this member.
export default function Agenda() {
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const { data: d, error, loading } = useLoad(async () => {
    const [me, list, ppl] = await Promise.all([data.myProfile(), data.forums(), data.people()]);
    return { me, list, ppl };
  });
  const { data: hits } = useLoad(() => data.searchMeetings(q), [q]);

  const t = today();
  const coming = (d?.list ?? []).filter((m) => m.status === "planned" && m.held_on >= t).reverse();
  const past = (d?.list ?? []).filter((m) => !(m.status === "planned" && m.held_on >= t));
  const next = coming[0];
  const last = coming[coming.length - 1]?.held_on ?? t;
  const unset = [1, 2].map((i) => monthName(addDays(`${last.slice(0, 7)}-15`, 30 * i)));
  const shown = q.trim() ? (hits ?? []).map((h) => past.find((p) => p.id === h.id) ?? { ...h, theme: null, has_agenda: false, updated_at: null, host_id: null }) : past;

  return (
    <ForumScreen>
      {loading && !d ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {d ? (
        <>
          {next ? (
            <View style={{ gap: 6 }}>
              <Eyebrow>{next.held_on === d.me.forum_joined_on ? "Your first forum" : "Next forum"}</Eyebrow>
              <Display size={58} style={{ marginBottom: space.rowGap }}>{weekday(next.held_on)}</Display>
              <Small tone={color.inkSoft}>
                {[next.starts_at ? time(next.starts_at) : null, next.place ?? "Place to be confirmed", next.host_id ? `host ${d.ppl.get(next.host_id)?.full_name ?? ""}` : null].filter(Boolean).join(" · ")}
              </Small>
              {next.theme ? <Body>Theme · {next.theme}</Body> : null}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
                <Button small label="Run sheet" onPress={() => router.push(`/forum/${next.held_on}`)} />
                <AddToCalendar meeting={next} small />
              </View>
            </View>
          ) : (
            <Body muted>No forum date is set yet.</Body>
          )}
          <View>
            <Eyebrow>Later</Eyebrow>
            {coming.slice(1).map((m) => (
              <Row key={m.id} left={<DayNum day={m.held_on.slice(8)} month={mon(m.held_on)} />} title={meetingTitle(m)} detail={m.place ?? "Place to be confirmed"} onPress={() => router.push(`/forum/${m.held_on}`)} />
            ))}
            {unset.map((mo) => (
              <Row key={mo} title={mo} right="Date not set" />
            ))}
            <Small style={{ marginTop: 6 }}>Dates are set by the moderator, Dave Hajdu.</Small>
          </View>
          <View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Eyebrow>Past forums</Eyebrow>
              <Button ghost small label={searching ? "Close" : "Search"} onPress={() => { setSearching(!searching); setQ(""); }} />
            </View>
            {searching ? <View style={{ marginTop: 8 }}><Field placeholder="Search your forums…" value={q} onChangeText={setQ} autoCapitalize="none" autoFocus returnKeyType="search" /></View> : null}
            {shown.length === 0 ? <Empty>{q.trim() ? "No forum matches." : "No forums yet."}</Empty> : null}
            {shown.map((m) => (
              <Row
                key={m.id}
                left={<DayNum day={m.held_on.slice(8)} month={mon(m.held_on)} />}
                title={meetingTitle(m)}
                detail={m.theme ?? (m.has_agenda ? "Agenda" : m.held_on === d.me.forum_joined_on ? "Your first forum" : null)}
                right={m.status === "planned" ? <Tag tone={color.amber}>planned</Tag> : undefined}
                onPress={() => router.push(`/forum/${m.held_on}`)}
              />
            ))}
            {d.me.forum_joined_on && !d.me.is_founding ? <Small style={{ marginTop: 8 }}>From your first forum, {long(d.me.forum_joined_on)}.</Small> : null}
          </View>
        </>
      ) : null}
    </ForumScreen>
  );
}
