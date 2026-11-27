// Small charts drawn with Views (no chart library): sparkline bars, the contest strip, monthly bars.
import { Pressable, StyleSheet, Text, View } from "react-native";
import { scoreColor } from "@shared/contest";
import type { Cell, Month } from "@shared/stats";
import { short } from "@/lib/format";
import { color, fs, radius } from "@/theme/tokens";

/** Bars scaled between the series' min and max; nulls are gaps. */
export function Spark({ values, tone = color.blue, height = 28 }: { values: (number | null)[]; tone?: string; height?: number }) {
  const xs = values.filter((v): v is number => v != null);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 1, height, flex: 1 }}>
      {values.map((v, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            height: v == null ? 2 : Math.max(2, hi === lo ? height / 2 : ((v - lo) / (hi - lo)) * (height - 2) + 2),
            backgroundColor: v == null ? color.line : tone,
            opacity: v == null ? 1 : 0.4 + (0.6 * (i + 1)) / values.length,
            borderRadius: 1,
          }}
        />
      ))}
    </View>
  );
}

/** One cell per contest day: scored (score color), missed (red outline), not uploaded yet (dim). */
export function Strip({ cells, onCell }: { cells: Cell[]; onCell?: (c: Cell) => void }) {
  return (
    <View style={st.strip} accessibilityLabel={`${cells.filter((c) => c.state === "scored").length} scored days`}>
      {cells.map((c) => (
        <Pressable
          key={c.day}
          onPress={onCell ? () => onCell(c) : undefined}
          accessibilityLabel={`${short(c.day)} ${c.state}`}
          style={[
            st.cell,
            c.state === "scored" && { backgroundColor: scoreColor(c.score ?? 0) },
            c.state === "missed" && { borderColor: color.red, borderWidth: 1 },
            c.state === "pending" && { backgroundColor: color.well },
          ]}
        />
      ))}
    </View>
  );
}

export function MonthBars({ months }: { months: Month[] }) {
  const hi = Math.max(100, ...months.map((m) => m.avg));
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, height: 120 }}>
      {months.slice(-8).map((m) => (
        <View key={m.month} style={{ flex: 1, alignItems: "center", gap: 4 }}>
          <Text style={st.small}>{Math.round(m.avg)}</Text>
          <View style={{ width: "100%", height: (m.avg / hi) * 80, backgroundColor: scoreColor(m.avg), borderRadius: radius.xs }} />
          <Text style={st.small}>{new Date(`${m.month}-15T00:00:00Z`).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" })}</Text>
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  strip: { flexDirection: "row", flexWrap: "wrap", gap: 3 },
  cell: { width: 12, height: 12, borderRadius: 3, borderColor: "transparent", borderWidth: 1 },
  small: { color: color.muted, fontSize: fs.xs2, fontVariant: ["tabular-nums"] },
});
