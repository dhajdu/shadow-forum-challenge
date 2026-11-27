// Publishes the race snapshot for the Home Screen widget (targets/widget). The widget reads it
// from the shared App Group. Needs the native ExtensionStorage module, which exists only in an
// EAS build with the widget target: in Expo Go and on web this is a no-op.
import { Platform } from "react-native";
import { dayOfContest, ranked } from "@shared/contest";
import type { Standing } from "@/data/types";

export const APP_GROUP = "group.com.talentedge.shadowforum";

type Storage = { set(key: string, value: string): void };
let storage: Storage | null | undefined;

function getStorage(): Storage | null {
  if (storage !== undefined) return storage;
  storage = null;
  if (Platform.OS !== "ios") return storage;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ExtensionStorage } = require("@bacons/apple-targets") as { ExtensionStorage: new (group: string) => Storage };
    storage = new ExtensionStorage(APP_GROUP);
  } catch {
    storage = null;
  }
  return storage;
}

/** Same fields as ios/Shared/WidgetSnapshot.swift; `updated` is ISO 8601. Race data only, never forum content. */
export function publishWidget(rows: Standing[], me: string): void {
  const s = getStorage();
  if (!s) return;
  const list = ranked(rows);
  const i = list.findIndex((r) => r.user_id === me);
  const snapshot = {
    myPlace: i >= 0 ? i + 1 : null,
    riders: list.length,
    myAvg: i >= 0 ? list[i].contest_avg : null,
    top: list.slice(0, 3).map((r) => ({ name: r.user_id === me ? "You" : r.full_name.split(" ")[0], avg: r.contest_days ? r.contest_avg : null, isMe: r.user_id === me })),
    contestDay: dayOfContest(),
    updated: new Date().toISOString(),
  };
  try {
    s.set("widgetSnapshot", JSON.stringify(snapshot));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require("@bacons/apple-targets") as { ExtensionStorage: { reloadWidget?: () => void } }).ExtensionStorage.reloadWidget?.();
  } catch {}
}
