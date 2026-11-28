// "✦ Ask AI" floats bottom right above the tab bar on every tab screen, as on the website.
// From a forum recap it opens scoped to that forum. Hidden in Chat, where the composer sits.
import { router, useGlobalSearchParams, usePathname } from "expo-router";
import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, font, fs, radius } from "@/theme/tokens";

const TAB_BAR = 49;

export function AskFab() {
  const path = usePathname();
  const { date } = useGlobalSearchParams<{ date?: string }>();
  const insets = useSafeAreaInsets();
  if (path === "/chat") return null;
  const meeting = path.startsWith("/forum/") && date ? date : undefined;
  return (
    <Pressable
      onPress={() => router.push(meeting ? { pathname: "/ask", params: { meeting } } : "/ask")}
      accessibilityRole="button"
      accessibilityLabel={meeting ? "Ask AI about this forum" : "Ask AI"}
      style={({ pressed }) => [s.fab, { bottom: TAB_BAR + insets.bottom + 12 }, pressed && { opacity: 0.8 }]}
    >
      <Text style={s.text}>✦ Ask AI</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 16,
    backgroundColor: color.blue,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: color.blue,
    shadowOpacity: 0.35,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  text: { color: color.white, fontSize: fs.sm, fontFamily: font.bold },
});
