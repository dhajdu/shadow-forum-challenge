import { Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from "@expo-google-fonts/inter";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Loading } from "@/components/ui";
import { UpdateGate } from "@/components/UpdateGate";
import { AuthProvider, useAuth } from "@/lib/auth";
import { useNotificationLinks } from "@/lib/links";
import { color, font } from "@/theme/tokens";

SplashScreen.preventAutoHideAsync().catch(() => {});

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
        <Stack.Screen name="ask" options={{ presentation: "modal" }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function Root() {
  const [loaded, error] = useFonts({
    [font.display]: require("../../assets/fonts/ArchivoCondensed-Black.ttf"),
    [font.body]: Inter_400Regular,
    [font.semi]: Inter_600SemiBold,
    [font.bold]: Inter_700Bold,
  });
  const go = loaded || error !== null;
  useEffect(() => {
    if (go) SplashScreen.hideAsync().catch(() => {});
  }, [go]);
  if (!go) return null;
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
