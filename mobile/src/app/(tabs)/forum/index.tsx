import { router } from "expo-router";
import { useState } from "react";
import { meetingTitle } from "@shared/forum";
import { SampleNote } from "@/components/SampleNote";
import { FORUM_NAV, SubNav } from "@/components/SubNav";
import { Banner, Body, Empty, Field, Header, Loading, Row, Screen, Tag } from "@/components/ui";
import * as data from "@/data";
import { long, short } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /forum — Agendas. Older forums are absent, not greyed out: the list is exactly what the database returned.
export default function Agendas() {
  const [q, setQ] = useState("");
  const { data: d, error, loading } = useLoad(async () => {
    const [profile, meetings] = await Promise.all([data.myProfile(), data.meetings()]);
    return { profile, meetings };
  });
  const { data: hits } = useLoad(() => data.searchMeetings(q), [q]);
  const list = q.trim() ? (hits ?? []) : (d?.meetings ?? []);

  return (
    <Screen>
      <Header title="Forum" />
      <SubNav items={FORUM_NAV} />
      <SampleNote />
      {loading && !d ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {d?.profile.forum_joined_on && !d.profile.is_founding ? (
        <Body muted>From your first forum, {long(d.profile.forum_joined_on)}.</Body>
      ) : null}
      {d ? (
        <Field placeholder="Search your forums…" value={q} onChangeText={setQ} autoCapitalize="none" clearButtonMode="while-editing" returnKeyType="search" />
      ) : null}
      {d && list.length === 0 ? <Empty>{q.trim() ? "No forum matches." : "No forums yet."}</Empty> : null}
      {list.map((m) => (
        <Row
          key={m.id}
          title={`${short(m.held_on)} · ${meetingTitle(m)}`}
          detail={m.status === "held" && m.place && !meetingTitle(m).includes(m.place) ? m.place : null}
          right={m.status === "planned" ? <Tag tone={color.amber}>planned</Tag> : null}
          onPress={() => router.push(`/forum/${m.held_on}`)}
        />
      ))}
    </Screen>
  );
}
