// Push registration with the Expo push service. The server stores the device
// (POST /api/push/devices) and sends only fixed, generic text; the lock screen never shows content.
// Notifications carry data.path (a website path) and tapping one opens that screen.
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { isDemo } from "@/data";
import { registerDevice, unregisterDevice } from "./api";
import { config } from "./config";

export type PushResult = { ok: true } | { ok: false; reason: string };

if (Platform.OS === "ios") Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

async function token(): Promise<string | null> {
  if (Platform.OS !== "ios" || !Device.isDevice || !config.easProjectId) return null;
  return (await Notifications.getExpoPushTokenAsync({ projectId: config.easProjectId })).data;
}

/** Asks for permission (only when `ask`), then registers this iPhone for the signed-in member. */
export async function registerForPush(ask: boolean): Promise<PushResult> {
  if (isDemo) return { ok: false, reason: "Demo mode: nothing is registered." };
  if (Platform.OS !== "ios") return { ok: false, reason: "Notifications are iPhone only." };
  if (!Device.isDevice) return { ok: false, reason: "Push needs a real iPhone, not the simulator." };
  if (!config.easProjectId) return { ok: false, reason: "No EAS project id yet (needs the Expo organisation)." };

  let { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted" && ask) status = (await Notifications.requestPermissionsAsync()).status;
  if (status !== "granted") return { ok: false, reason: "Notifications are off. Turn them on in Settings." };

  try {
    const t = await token();
    if (!t) return { ok: false, reason: "No push token." };
    await registerDevice(t, `${config.appVersion} (${config.buildNumber})`);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

/** On sign-out, so a shared phone stops getting this member's pushes. Call before the session ends. */
export async function revokePush(): Promise<void> {
  if (isDemo) return;
  try {
    const t = await token();
    if (t) await unregisterDevice(t);
  } catch {}
}

export async function permissionGranted(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  return (await Notifications.getPermissionsAsync()).status === "granted";
}
