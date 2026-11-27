// Unread forum-chat count for the Forum tab badge. Refreshed on start, on any chat change,
// when the app comes back to the foreground, and after the chat screen marks itself read.
import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import * as data from "@/data";

let count = 0;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export async function refreshUnread(): Promise<void> {
  const n = await data.unreadChat().catch(() => count);
  if (n === count) return;
  count = n;
  listeners.forEach((l) => l());
}

/** Mount once (tabs layout). Returns the count. */
export function useUnreadChat(): number {
  useEffect(() => {
    refreshUnread();
    const off = data.onChatChange(refreshUnread);
    const app = AppState.addEventListener("change", (s) => s === "active" && refreshUnread());
    return () => {
      off();
      app.remove();
    };
  }, []);
  return useSyncExternalStore(subscribe, () => count);
}
