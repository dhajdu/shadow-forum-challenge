import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Loading } from "@/components/ui";
import { UpdateGate } from "@/components/UpdateGate";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useNotificationLinks } from "@/lib/links";
import { color } from "@/theme/tokens";

function Gate() {
  const { session, ready, demo } = useAuth();
  const signedIn = demo || session !== null;
  useNotificationLinks(ready && signedIn);
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, justifyContent: "center" }}>
        <Loading />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="race" />
        <Stack.Screen name="rider/[id]" />
        <Stack.Screen name="report" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function Root() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="light" />
        <UpdateGate>
          <Gate />
        </UpdateGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
