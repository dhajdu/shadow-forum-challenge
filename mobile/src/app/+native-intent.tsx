// Universal Links and pushes carry the website's paths. The app's routes are the same paths, except
// where a section lives under another tab in the app (/gallery → /forum/photos, /kitty → /forum/kitty,
// /goals → /contest/goals, /biometrics → /me/biometrics); appPath() maps those.
import { appPath } from "@/lib/links";

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    // shadowforum://me?whoop=ok (WHOOP sign-in return) → /me?whoop=ok
    const url = new URL(path.replace(/^shadowforum:\/\//, "/"), "https://eoshadowforum.com");
    return appPath(url.pathname) + url.search;
  } catch {
    return "/";
  }
}
