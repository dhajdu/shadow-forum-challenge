import Ionicons from "@expo/vector-icons/Ionicons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { View } from "react-native";
import { AccessGate } from "@/components/AccessGate";
import { AskFab } from "@/components/AskFab";
import { ConstitutionGate } from "@/components/ConstitutionGate";
import { ShareIntake } from "@/components/ShareIntake";
import { useUnreadChat } from "@/lib/unread";
import { color, font, fs } from "@/theme/tokens";

type Icon = ComponentProps<typeof Ionicons>["name"];
const icon = (on: Icon, off: Icon) =>
  function TabIcon({ color: c, size, focused }: { color: unknown; size: number; focused: boolean }) {
    return <Ionicons name={focused ? on : off} color={typeof c === "string" ? c : undefined} size={size - 2} />;
  };

// Five tabs for what members do between forums. Ask AI floats above them on every screen.
export default function TabsLayout() {
  const unread = useUnreadChat();
  return (
    <AccessGate>
      <ConstitutionGate>
        <ShareIntake />
        <View style={{ flex: 1 }}>
          <Tabs
            screenOptions={{
              headerShown: false,
              tabBarActiveTintColor: color.ink,
              tabBarInactiveTintColor: color.muted,
              tabBarStyle: { backgroundColor: color.bg2, borderTopColor: color.lineSoft },
              tabBarLabelStyle: { fontSize: fs.xs2, fontFamily: font.semi, letterSpacing: 0.3 },
              sceneStyle: { backgroundColor: color.bg },
            }}
          >
            <Tabs.Screen name="index" options={{ title: "Home", tabBarIcon: icon("home", "home-outline") }} />
            <Tabs.Screen name="forum" options={{ title: "Forum", tabBarIcon: icon("people", "people-outline") }} />
            <Tabs.Screen
              name="chat"
              options={{
                title: "Chat",
                tabBarIcon: icon("chatbubbles", "chatbubbles-outline"),
                tabBarBadge: unread > 0 ? (unread > 99 ? "99+" : unread) : undefined,
                tabBarBadgeStyle: { backgroundColor: color.blue, fontSize: fs.xs2 },
              }}
            />
            <Tabs.Screen name="contest" options={{ title: "Contest", tabBarIcon: icon("trophy", "trophy-outline") }} />
            <Tabs.Screen name="me" options={{ title: "Me", tabBarIcon: icon("person-circle", "person-circle-outline") }} />
          </Tabs>
          <AskFab />
        </View>
      </ConstitutionGate>
    </AccessGate>
  );
}
