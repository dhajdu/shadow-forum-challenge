// Topics (the agenda's Parking Lot): grouped by the forum they were raised at, newest first.
import { Text, View } from "react-native";
import type { ParkingGroup } from "@/data";
import { long } from "@/lib/format";
import { color, font, fs } from "@/theme/tokens";
import { Avatar } from "./Avatar";
import { Body, Eyebrow, Small, Tag } from "./ui";

export function TopicList({ groups, compact }: { groups: ParkingGroup[]; compact?: boolean }) {
  if (groups.length === 0) return <Small>No topics waiting. Every one got its time.</Small>;
  const sorted = [...groups].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  return (
    <View style={{ gap: 16 }}>
      {(compact ? sorted.slice(0, 2) : sorted).map((g, gi) => (
        <View key={gi} style={{ gap: 10 }}>
          <Eyebrow>{g.date ? `Raised ${long(g.date)}` : g.label}</Eyebrow>
          {g.topics.map((t, i) => (
            <View key={i} style={{ flexDirection: "row", gap: 10, borderBottomWidth: 1, borderBottomColor: color.lineSoft, paddingBottom: 10 }}>
              <Avatar name={t.who ?? "?"} url={null} size={28} />
              <View style={{ flex: 1, gap: 3 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
                  <Text style={{ color: color.ink, fontFamily: font.semi, fontSize: fs.base, flex: 1 }}>{t.topic}</Text>
                  {t.nextForum ? <Tag tone={color.blue}>Next forum</Tag> : null}
                </View>
                {t.who ? <Small>{t.who}</Small> : null}
                {t.details.map((x, k) => (
                  <Body key={k} muted>
                    {x}
                  </Body>
                ))}
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
