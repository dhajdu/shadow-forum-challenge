import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { AccessGate } from "@/components/AccessGate";
import { ShareIntake } from "@/components/ShareIntake";
import { useUnreadChat } from "@/lib/unread";
import { color, fs } from "@/theme/tokens";

type Icon = ComponentProps<typeof Ionicons>["name"];
const icon = (name: Icon) =>
  function TabIcon({ color: c, size }: { color: unknown; size: number }) {
    return <Ionicons name={name} color={typeof c === "string" ? c : undefined} size={size} />;
  };

// Nav "A · Forum first": Home, Forum, Contest, Ask, Me. Paths match the website.
export default function TabsLayout() {
  const unread = useUnreadChat();
  return (
    <AccessGate>
    <ShareIntake />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.ink,
        tabBarInactiveTintColor: color.muted,
        tabBarStyle: { backgroundColor: color.bg2, borderTopColor: color.line },
        tabBarLabelStyle: { fontSize: fs.xs2, fontWeight: "600" },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home") }} />
      <Tabs.Screen name="forum" options={{ title: "Forum", tabBarIcon: icon("people"), tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined, tabBarBadgeStyle: { backgroundColor: color.blue, fontSize: fs.xs2 } }} />
      <Tabs.Screen name="contest" options={{ title: "Contest", tabBarIcon: icon("trophy") }} />
      <Tabs.Screen name="ask" options={{ title: "Ask", tabBarIcon: icon("chatbubble-ellipses") }} />
      <Tabs.Screen name="me" options={{ title: "Me", tabBarIcon: icon("person-circle") }} />
    </Tabs>
    </AccessGate>
  );
}
