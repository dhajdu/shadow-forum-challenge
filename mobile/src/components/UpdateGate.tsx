// MOBILE_MIN_BUILD: the server says which build is the oldest it accepts (GET /api/mobile/config),
// and any API call from an older build gets 426. Either way the app shows "Update the app".
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { Linking, View } from "react-native";
import { Body, Button, Header } from "@/components/ui";
import { minBuild, updateSignal } from "@/lib/api";
import { config } from "@/lib/config";
import { color, space } from "@/theme/tokens";

export function UpdateGate({ children }: { children: ReactNode }) {
  const tooOld = useSyncExternalStore(updateSignal.subscribe, updateSignal.get, updateSignal.get);
  useEffect(() => {
    if (!config.buildNumber) return;
    minBuild()
      .then((min) => {
        if (min && config.buildNumber < min) updateSignal.set();
      })
      .catch(() => {});
  }, []);
  if (!tooOld) return <>{children}</>;
  return (
    <View style={{ flex: 1, backgroundColor: color.bg, padding: space.page, justifyContent: "center", gap: 16 }}>
      <Header title="Update the app" />
      <Body muted>This version of Shadow Forum is too old. Update it from TestFlight or the App Store.</Body>
      <Button label="Open TestFlight" onPress={() => Linking.openURL("itms-beta://")} />
    </View>
  );
}
