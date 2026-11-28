// A row of choices as square chips (single select), for short lists inside forms and sheets.
import { Pressable, ScrollView, Text } from "react-native";
import { color, font, fs } from "@/theme/tokens";

export function Picker<T extends string>({ options, value, onChange, wrap }: { options: readonly { key: T; label: string }[]; value: T | null; onChange: (v: T) => void; wrap?: boolean }) {
  const chips = options.map((o) => {
    const on = o.key === value;
    return (
      <Pressable
        key={o.key}
        onPress={() => onChange(o.key)}
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        style={{ borderWidth: 1, borderColor: on ? color.ink : color.line, backgroundColor: on ? color.ink : "transparent", paddingHorizontal: 10, paddingVertical: 7, marginBottom: wrap ? 6 : 0 }}
      >
        <Text style={{ color: on ? color.bg : color.inkSoft, fontFamily: font.semi, fontSize: fs.sm }}>{o.label}</Text>
      </Pressable>
    );
  });
  if (wrap) return <ScrollView scrollEnabled={false} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>{chips}</ScrollView>;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
      {chips}
    </ScrollView>
  );
}
