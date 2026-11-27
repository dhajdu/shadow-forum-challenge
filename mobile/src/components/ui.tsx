// Native twins of the web's global classes (.zone-card, .btn, .btn-ghost, .field, .seg, .chip, .kpi, .xc-item, .eyebrow).
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { GoalStatus } from "@shared/database.types";
import { color, fs, goalColor, goalLabel, radius, space } from "@/theme/tokens";

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  return (
    <SafeAreaView style={s.screen} edges={["top"]}>
      {scroll ? (
        <ScrollView contentContainerStyle={s.screenBody} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.screenBody, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Header({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={s.header}>
      <Text style={s.title} accessibilityRole="header">
        {title}
      </Text>
      {right}
    </View>
  );
}

export function Eyebrow({ children, tone = color.muted }: { children: ReactNode; tone?: string }) {
  return <Text style={[s.eyebrow, { color: tone }]}>{children}</Text>;
}

export function Card({
  children,
  title,
  onPress,
  style,
}: {
  children?: ReactNode;
  title?: string;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const body = (
    <>
      {title ? <Eyebrow>{title}</Eyebrow> : null}
      {children}
    </>
  );
  if (!onPress) return <View style={[s.card, style]}>{body}</View>;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [s.card, style, pressed && { borderColor: color.blueEdge }]}
    >
      {body}
    </Pressable>
  );
}

export function Big({ children, tone = color.ink }: { children: ReactNode; tone?: string }) {
  return <Text style={[s.big, { color: tone }]}>{children}</Text>;
}

export function Body({ children, muted, style }: { children: ReactNode; muted?: boolean; style?: object }) {
  return <Text style={[s.body, muted && { color: color.muted }, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  busy,
  disabled,
  ghost,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  ghost?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        ghost ? s.ghost : s.btn,
        (busy || disabled) && { opacity: 0.5 },
        pressed && { opacity: 0.8 },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color.ink} />
      ) : (
        <Text style={ghost ? s.ghostText : s.btnText}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: 6 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput placeholderTextColor={color.muted} style={[s.field, style]} {...rest} />
    </View>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[s.segBtn, on && s.segOn]}
          >
            <Text style={[s.segText, on && { color: color.white }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Chip({ status }: { status: GoalStatus }) {
  const c = goalColor[status];
  return (
    <View style={[s.chip, { borderColor: c }]}>
      <Text style={[s.chipText, { color: c }]}>{goalLabel[status]}</Text>
    </View>
  );
}

export function Tag({ children, tone = color.muted }: { children: ReactNode; tone?: string }) {
  return (
    <View style={[s.chip, { borderColor: color.line }]}>
      <Text style={[s.chipText, { color: tone }]}>{children}</Text>
    </View>
  );
}

export function Kpi({ value, label, tone = color.ink }: { value: string; label: string; tone?: string }) {
  return (
    <View style={s.kpi}>
      <Text style={[s.kpiValue, { color: tone }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

export function Row({
  title,
  detail,
  right,
  onPress,
}: {
  title: string;
  detail?: string | null;
  right?: ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [s.row, pressed && { borderColor: color.blueEdge }]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {detail ? <Text style={s.rowDetail}>{detail}</Text> : null}
      </View>
      {right}
      {onPress ? <Text style={s.chev}>›</Text> : null}
    </Pressable>
  );
}

export function Banner({ children, tone = color.amber }: { children: ReactNode; tone?: string }) {
  return (
    <View style={[s.banner, { borderColor: tone }]}>
      <Text style={[s.body, { color: color.ink }]}>{children}</Text>
    </View>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <Text style={s.empty}>{children}</Text>;
}

export function Bar({ pct, tone = color.blue }: { pct: number; tone?: string }) {
  return (
    <View style={s.bar}>
      <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height: "100%", backgroundColor: tone }} />
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: 40 }}>
      <ActivityIndicator color={color.blue} />
    </View>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  screenBody: { padding: space.page, paddingBottom: 60, gap: space.cardGap },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: fs.xl3, fontWeight: "800", color: color.ink, letterSpacing: -0.3 },
  eyebrow: { fontSize: fs.xs, fontWeight: "700", letterSpacing: 1.4, textTransform: "uppercase" },
  card: {
    backgroundColor: color.surface,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingVertical: space.cardY - 4,
    paddingHorizontal: space.cardX - 4,
    gap: 6,
  },
  big: { fontSize: fs.xl, fontWeight: "800", fontVariant: ["tabular-nums"] },
  body: { fontSize: fs.base, color: color.inkSoft, lineHeight: 20 },
  btn: {
    backgroundColor: color.blue,
    borderRadius: radius.md,
    paddingVertical: 13,
    alignItems: "center",
    shadowColor: color.blue,
    shadowOpacity: 0.22,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  btnText: { color: color.white, fontSize: fs.lg, fontWeight: "700" },
  ghost: {
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 11,
    paddingHorizontal: 14,
    alignItems: "center",
    backgroundColor: color.well,
  },
  ghostText: { color: color.ink, fontSize: fs.md, fontWeight: "700" },
  label: { fontSize: fs.sm, color: color.muted, fontWeight: "600" },
  field: {
    backgroundColor: color.well,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: color.ink,
    fontSize: fs.lg,
  },
  seg: {
    flexDirection: "row",
    gap: 4,
    padding: 4,
    backgroundColor: color.well,
    borderRadius: radius.pill,
    borderColor: color.line,
    borderWidth: 1,
  },
  segBtn: { flex: 1, paddingVertical: 8, borderRadius: radius.pill, alignItems: "center" },
  segOn: {
    backgroundColor: color.blue,
    shadowColor: color.blue,
    shadowOpacity: 0.4,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 0 },
  },
  segText: { fontSize: fs.sm, fontWeight: "700", color: color.muted },
  chip: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  chipText: { fontSize: fs.xs, fontWeight: "700" },
  kpi: {
    flex: 1,
    backgroundColor: color.well,
    borderRadius: radius.lg,
    paddingVertical: space.tileY,
    paddingHorizontal: space.tileX,
    borderColor: color.line,
    borderWidth: 1,
  },
  kpiValue: { fontSize: fs.xl2, fontWeight: "800", fontVariant: ["tabular-nums"] },
  kpiLabel: { fontSize: fs.xs, color: color.muted, marginTop: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.gap,
    backgroundColor: color.wellSoft,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: space.rowY + 2,
    paddingHorizontal: space.rowX,
  },
  rowTitle: { fontSize: fs.base, color: color.ink, fontWeight: "600" },
  rowDetail: { fontSize: fs.sm, color: color.muted },
  chev: { fontSize: fs.xl, color: color.muted },
  banner: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: space.rowY,
    paddingHorizontal: space.rowX,
    backgroundColor: color.well,
  },
  empty: { textAlign: "center", color: color.muted, fontSize: fs.md, paddingVertical: 24 },
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: color.well, overflow: "hidden" },
});
