// A pushed screen's native header with the right back label.
import { Stack } from "expo-router";
import { color } from "@/theme/tokens";

export function Head({ title = "", back }: { title?: string; back: string }) {
  return (
    <Stack.Screen
      options={{
        headerShown: true,
        title,
        headerBackTitle: back,
        headerStyle: { backgroundColor: color.bg },
        headerTintColor: color.ink,
        headerShadowVisible: false,
      }}
    />
  );
}
