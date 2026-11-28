// Native twins of the website's Neon Noir classes (docs/design-system.md): page banners, condensed
// uppercase titles, hairline sections instead of boxed cards, square buttons, red-underlined tabs.
import { Image, type ImageContentPosition } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import type { ReactNode } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type RefreshControlProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { GoalStatus } from "@shared/database.types";
import { bannerH, barH, color, font, fs, goalColor, goalLabel, radius, space, trackLabel } from "@/theme/tokens";

export const BANNERS = {
  hero: require("../../assets/banners/hero.jpg"),
  landing: require("../../assets/banners/landing.jpg"),
  back: require("../../assets/banners/back.jpg"),
  front: require("../../assets/banners/front.jpg"),
  kitty: require("../../assets/banners/kitty.jpg"),
  chat: require("../../assets/banners/chat.jpg"),
  stances: require("../../assets/banners/stances.jpg"),
  goals: require("../../assets/banners/goals.jpg"),
  me: require("../../assets/banners/me.jpg"),
  ask: require("../../assets/banners/ask.jpg"),
} as const;
export type BannerName = keyof typeof BANNERS;

/** The image band at the top of a page, fading into the page (web: PageBanner). */
export function PageBanner({
  image,
  height = bannerH,
  position = "50% 40%",
  children,
}: {
  image: BannerName;
  height?: number;
  position?: string;
  children?: ReactNode;
}) {
  return (
    <View style={{ height, justifyContent: "flex-end" }}>
      <Image source={BANNERS[image]} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={position as ImageContentPosition} transition={0} />
      <LinearGradient colors={[color.bannerTop, color.bannerMid, color.bg]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
      <View style={{ paddingHorizontal: space.page, paddingBottom: 12 }}>{children}</View>
    </View>
  );
}

/**
 * A page. With `banner`, the title sits on the image band; `back` adds a back link above it.
 * `tabs` (section tabs) sit under the title. Content scrolls unless `scroll={false}`.
 */
export function Screen({
  children,
  scroll = true,
  banner,
  title,
  back,
  right,
  tabs,
  refresh,
  pad = true,
}: {
  children?: ReactNode;
  scroll?: boolean;
  banner?: BannerName;
  title?: string;
  back?: string;
  right?: ReactNode;
  tabs?: ReactNode;
  refresh?: React.ReactElement<RefreshControlProps>;
  pad?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const head = (
    <>
      {banner ? (
        <PageBanner image={banner} height={bannerH + insets.top}>
          {back ? <BackLink label={back} /> : null}
          {title ? <Title>{title}</Title> : null}
        </PageBanner>
      ) : (
        <View style={{ paddingTop: insets.top + 8, paddingHorizontal: space.page }}>
          {back ? <BackLink label={back} /> : null}
          {title ? <Title>{title}</Title> : null}
        </View>
      )}
      {right ? <View style={[s.right, { top: insets.top + 8 }]}>{right}</View> : null}
      {tabs ? <View style={{ paddingHorizontal: space.page }}>{tabs}</View> : null}
    </>
  );
  const body = <View style={[pad && s.body, !scroll && { flex: 1 }]}>{children}</View>;
  return (
    <View style={s.screen}>
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingBottom: 110 }} keyboardShouldPersistTaps="handled" refreshControl={refresh}>
          {head}
          {body}
        </ScrollView>
      ) : (
        <>
          {head}
          {body}
        </>
      )}
    </View>
  );
}

export function BackLink({ label }: { label: string }) {
  return (
    <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))} accessibilityRole="link" hitSlop={10}>
      <Text style={s.back}>‹ {label}</Text>
    </Pressable>
  );
}

/** Condensed uppercase display text: page titles, dates, big numbers. */
export function Display({ children, size = fs.display, tone = color.ink, style }: { children: ReactNode; size?: number; tone?: string; style?: StyleProp<TextStyle> }) {
  return (
    <Text style={[s.display, { fontSize: size, lineHeight: size * 0.95, color: tone }, style]} numberOfLines={2} adjustsFontSizeToFit>
      {typeof children === "string" ? children.toUpperCase() : children}
    </Text>
  );
}

export function Title({ children }: { children: string }) {
  return (
    <Text style={s.title} accessibilityRole="header" numberOfLines={2} adjustsFontSizeToFit>
      {children.toUpperCase()}
    </Text>
  );
}

/** Kept for older screens: a plain title row. */
export function Header({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Title>{title}</Title>
      {right}
    </View>
  );
}

export function Eyebrow({ children, tone = color.muted }: { children: ReactNode; tone?: string }) {
  return <Text style={[s.eyebrow, { color: tone }]}>{typeof children === "string" ? children.toUpperCase() : children}</Text>;
}

/** A section: hairline on top, optional label. No box (Neon Noir rule 0). */
export function Card({
  children,
  title,
  onPress,
  style,
  right,
}: {
  children?: ReactNode;
  title?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  right?: ReactNode;
}) {
  const head = title || right ? (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      {title ? <Eyebrow>{title}</Eyebrow> : <View />}
      {right}
    </View>
  ) : null;
  if (!onPress)
    return (
      <View style={[s.section, style]}>
        {head}
        {children}
      </View>
    );
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.section, style, pressed && { opacity: 0.7 }]}>
      {head}
      {children}
    </Pressable>
  );
}

export function Big({ children, tone = color.ink }: { children: ReactNode; tone?: string }) {
  return <Text style={[s.big, { color: tone }]}>{children}</Text>;
}

export function Body({ children, muted, style, numberOfLines }: { children: ReactNode; muted?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  return (
    <Text style={[s.text, muted && { color: color.muted, fontSize: fs.md }, style]} numberOfLines={numberOfLines}>
      {children}
    </Text>
  );
}

export function Small({ children, tone = color.muted, style }: { children: ReactNode; tone?: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[s.small, { color: tone }, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  busy,
  disabled,
  ghost,
  danger,
  small,
  style,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  ghost?: boolean;
  danger?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const outline = ghost || danger;
  const tone = danger ? color.red : outline ? color.ink : color.bg;
  return (
    <Pressable
      onPress={onPress}
      disabled={busy || disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        s.btn,
        small && s.btnSmall,
        outline && { backgroundColor: "transparent", borderColor: danger ? color.red : color.line },
        (busy || disabled) && { opacity: 0.45 },
        pressed && { opacity: 0.75 },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={tone} /> : <Text style={[s.btnText, small && { fontSize: fs.xs }, { color: tone }]}>{label.toUpperCase()}</Text>}
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

/** Segmented control for a choice inside a page (money in / out, by forum / by month). */
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
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[s.segBtn, on && { backgroundColor: color.ink }]}>
            <Text style={[s.segText, on && { color: color.bg }]}>{o.label.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Section tabs: uppercase text with a red underline (web: SubTabs). */
export function Tabs<T extends string>({ options, value, onChange }: { options: readonly { key: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabs} contentContainerStyle={{ gap: 18 }}>
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={[s.tab, on && { borderBottomColor: color.red }]} hitSlop={6}>
            <Text style={[s.tabText, on && { color: color.ink }]}>{o.label.toUpperCase()}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Chip({ status }: { status: GoalStatus }) {
  const c = goalColor[status];
  return (
    <View style={[s.chip, { borderColor: c }]}>
      <Text style={[s.chipText, { color: c }]}>{goalLabel[status].toUpperCase()}</Text>
    </View>
  );
}

export function Tag({ children, tone = color.muted }: { children: ReactNode; tone?: string }) {
  return (
    <View style={[s.chip, { borderColor: tone === color.muted ? color.line : tone }]}>
      <Text style={[s.chipText, { color: tone }]}>{typeof children === "string" ? children.toUpperCase() : children}</Text>
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
  left,
  onPress,
  onLongPress,
}: {
  title: ReactNode;
  detail?: ReactNode;
  right?: ReactNode;
  left?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={!onPress && !onLongPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
    >
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        {typeof title === "string" ? <Text style={s.rowTitle}>{title}</Text> : title}
        {detail ? typeof detail === "string" ? <Text style={s.rowDetail}>{detail}</Text> : detail : null}
      </View>
      {typeof right === "string" ? <Text style={s.rowDetail}>{right}</Text> : right}
      {onPress ? <Text style={s.chev}>›</Text> : null}
    </Pressable>
  );
}

/** A day number in a list (web: .row-when). */
export function DayNum({ day, month }: { day: string; month: string }) {
  return (
    <View style={{ width: 54, flexDirection: "row", alignItems: "baseline", gap: 3 }}>
      <Text style={[s.display, { fontSize: fs.xl2 + 4, lineHeight: fs.xl2 + 6 }]}>{day}</Text>
      <Text style={s.eyebrowTight}>{month.toUpperCase()}</Text>
    </View>
  );
}

export function Banner({ children, tone = color.amber }: { children: ReactNode; tone?: string }) {
  return (
    <View style={[s.notice, { borderLeftColor: tone }]}>
      <Text style={[s.text, { color: color.ink }]}>{children}</Text>
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

export function Hr() {
  return <View style={{ height: 1, backgroundColor: color.line }} />;
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.bg },
  body: { paddingHorizontal: space.page, paddingTop: 12, gap: space.rowGap },
  right: { position: "absolute", right: space.page },
  back: { color: color.inkSoft, fontSize: fs.sm, fontFamily: font.semi, marginBottom: 6, letterSpacing: 0.4 },
  display: { fontFamily: font.display, color: color.ink, textTransform: "uppercase" },
  title: { fontFamily: font.display, fontSize: fs.display, lineHeight: fs.display * 0.92, color: color.ink, textTransform: "uppercase" },
  eyebrow: { fontSize: fs.xs, fontFamily: font.semi, letterSpacing: trackLabel, textTransform: "uppercase" },
  eyebrowTight: { fontSize: fs.xs2, fontFamily: font.semi, letterSpacing: 1.5, color: color.muted },
  section: { borderTopWidth: 1, borderTopColor: color.line, paddingTop: 14, paddingBottom: 6, gap: 8 },
  big: { fontSize: fs.xl, fontFamily: font.bold, fontVariant: ["tabular-nums"] },
  text: { fontSize: fs.base, color: color.inkSoft, lineHeight: 20, fontFamily: font.body },
  small: { fontSize: fs.sm, fontFamily: font.body, lineHeight: 17 },
  btn: {
    backgroundColor: color.ink,
    borderRadius: radius.btn,
    borderWidth: 1,
    borderColor: color.ink,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12, alignSelf: "flex-start" },
  btnText: { fontSize: fs.sm, fontFamily: font.bold, letterSpacing: 1.2 },
  label: { fontSize: fs.sm, color: color.muted, fontFamily: font.semi },
  field: {
    backgroundColor: color.well,
    borderColor: color.line,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 14,
    color: color.ink,
    fontSize: fs.lg,
    fontFamily: font.body,
  },
  seg: { flexDirection: "row", borderWidth: 1, borderColor: color.line, borderRadius: radius.btn },
  segBtn: { flex: 1, paddingVertical: 9, alignItems: "center" },
  segText: { fontSize: fs.xs, fontFamily: font.bold, letterSpacing: 1, color: color.muted },
  tabs: { borderBottomWidth: 1, borderBottomColor: color.lineSoft, flexGrow: 0, marginTop: 4 },
  tab: { paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: fs.xs, fontFamily: font.bold, letterSpacing: 1.4, color: color.muted },
  chip: { alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: fs.xs2, fontFamily: font.bold, letterSpacing: 0.8 },
  kpi: { flex: 1, paddingVertical: 6 },
  kpiValue: { fontSize: fs.xl3, fontFamily: font.display, fontVariant: ["tabular-nums"] },
  kpiLabel: { fontSize: fs.xs, color: color.muted, marginTop: 2, fontFamily: font.body },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.gap + 2,
    borderBottomWidth: 1,
    borderBottomColor: color.lineSoft,
    paddingVertical: space.rowY + 2,
  },
  rowTitle: { fontSize: fs.base, color: color.ink, fontFamily: font.semi },
  rowDetail: { fontSize: fs.sm, color: color.muted, fontFamily: font.body },
  chev: { fontSize: fs.xl, color: color.muted },
  notice: { borderLeftWidth: 2, paddingVertical: 8, paddingHorizontal: space.rowX, backgroundColor: color.well },
  empty: { textAlign: "center", color: color.muted, fontSize: fs.md, paddingVertical: 24, fontFamily: font.body },
  bar: { height: barH, backgroundColor: color.lineSoft, overflow: "hidden" },
});
