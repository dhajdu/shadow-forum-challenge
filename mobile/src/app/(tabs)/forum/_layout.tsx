import { Stack } from "expo-router";
import { color } from "@/theme/tokens";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.bg },
        headerStyle: { backgroundColor: color.bg },
        headerTintColor: color.ink,
        headerShadowVisible: false,
      }}
    />
  );
}
