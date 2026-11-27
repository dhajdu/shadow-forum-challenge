// Minimal Markdown for imported agendas and library pages: headings, bullets, numbered lines, **bold**.
// Text only: links and HTML are shown as plain text, nothing is executed or fetched.
import { Text, View } from "react-native";
import { color, fs } from "@/theme/tokens";

function inline(line: string, key: number) {
  const parts = line.split(/(\*\*[^*]+\*\*)/g);
  return (
    <Text key={key} style={{ color: color.inkSoft, fontSize: fs.base, lineHeight: 21 }}>
      {parts.map((p, i) =>
        p.startsWith("**") && p.endsWith("**") ? (
          <Text key={i} style={{ fontWeight: "700", color: color.ink }}>
            {p.slice(2, -2)}
          </Text>
        ) : (
          p
        ),
      )}
    </Text>
  );
}

export function Markdown({ text }: { text: string }) {
  return (
    <View style={{ gap: 6 }}>
      {text.split("\n").map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <View key={i} style={{ height: 4 }} />;
        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h)
          return (
            <Text key={i} style={{ color: color.ink, fontWeight: "800", fontSize: h[1].length === 1 ? fs.xl : fs.lg, marginTop: 6 }}>
              {h[2]}
            </Text>
          );
        const b = line.match(/^\s*[-*]\s+(.*)$/);
        if (b)
          return (
            <View key={i} style={{ flexDirection: "row", gap: 8, paddingLeft: 4 }}>
              <Text style={{ color: color.muted }}>•</Text>
              <View style={{ flex: 1 }}>{inline(b[1], 0)}</View>
            </View>
          );
        return inline(line, i);
      })}
    </View>
  );
}
