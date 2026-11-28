// Push notifications carry a website path in data.path. Tapping one opens that screen.
// Universal Links (https://eoshadowforum.com/...) are routed by expo-router itself, because the
// app's routes are the website's paths.
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

/** Paths the app knows; anything else opens Home. Old web paths map to their new homes. */
export function appPath(path: string): string {
  const p = path.split("?")[0].replace(/\/+$/, "") || "/";
  if (p === "/report") return "/contest/report";
  if (p === "/race") return "/contest";
  if (p.startsWith("/rider/")) return `/contest${p}`;
  if (p === "/forum/chat") return "/chat";
  if (p.startsWith("/forum/thread/")) return p.replace("/forum/thread/", "/chat/thread/");
  if (p === "/gallery" || p === "/forum/gallery") return "/forum/photos";
  if (p === "/kitty") return "/forum/kitty";
  if (p === "/goals" || p === "/contest/goal") return "/contest/goals";
  if (p === "/biometrics") return "/me/biometrics";
  if (p === "/forum/parking") return "/forum/topics";
  if (p.startsWith("/forum/library")) return p.replace("/forum/library", "/forum/resources");
  if (/^\/(forum|contest|chat|ask|me)(\/|$)/.test(p) || p === "/") return path;
  return "/";
}

export function useNotificationLinks(enabled: boolean) {
  useEffect(() => {
    if (!enabled || Platform.OS !== "ios") return;
    const open = (r: Notifications.NotificationResponse | null) => {
      const path = r?.notification.request.content.data?.path;
      if (typeof path === "string") router.push(appPath(path) as never);
    };
    // The tap that launched the app, then any tap while it runs.
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [enabled]);
}
