import * as Clipboard from "expo-clipboard";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Banner, Body, Button, Card, Eyebrow, Header, Loading, Row, Screen } from "@/components/ui";
import * as data from "@/data";
import { WHOOP_RESULT, whoopConnectUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { ago, long } from "@/lib/format";
import { permissionGranted, registerForPush } from "@/lib/push";
import { useLoad } from "@/lib/useLoad";
import { color, fs } from "@/theme/tokens";

const MCP_URL = `${config.apiBaseUrl}/api/mcp`;

export default function Me() {
  const { signOut, demo } = useAuth();
  const { whoop: whoopResult } = useLocalSearchParams<{ whoop?: string }>();
  const { data: d, error, loading, reload } = useLoad(async () => {
    const [profile, whoop, pushOn] = await Promise.all([data.myProfile(), data.whoopStatus(), permissionGranted()]);
    return { profile, whoop, pushOn };
  });
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [mcpOpen, setMcpOpen] = useState(false);

  // A Universal Link to /me?whoop=<code> (e.g. from Safari) shows the result here.
  useEffect(() => {
    if (whoopResult) {
      setNote(WHOOP_RESULT[whoopResult] ?? WHOOP_RESULT.error);
      reload();
    }
  }, [whoopResult, reload]);

  if (loading && !d) return <Screen><Loading /></Screen>;
  if (error || !d) return <Screen><Banner tone={color.red}>{error ?? "Nothing to show."}</Banner></Screen>;
  const { profile, whoop, pushOn } = d;
  const connected = whoop.status === "connected";

  async function connectWhoop() {
    setNote(null);
    if (demo) return setNote({ ok: false, text: "Demo mode: nothing is connected." });
    try {
      const url = await whoopConnectUrl();
      if (!url) {
        // Server without the app flow: connect on the website, signed in there.
        await WebBrowser.openBrowserAsync(`${config.apiBaseUrl}/me`);
        return reload();
      }
      // WHOOP's sign-in ends on shadowforum://me?whoop=<code>, which closes the sheet.
      const r = await WebBrowser.openAuthSessionAsync(url, "shadowforum://me");
      if (r.type === "success") {
        const code = new URL(r.url).searchParams.get("whoop") ?? "error";
        setNote(WHOOP_RESULT[code] ?? WHOOP_RESULT.error);
      }
      reload();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function notifications() {
    const r = await registerForPush(true);
    setNote(r.ok ? { ok: true, text: "Notifications on. They never show forum content on the lock screen." } : { ok: false, text: r.reason });
    reload();
  }

  return (
    <Screen>
      <Header title="Me" />
      <Card onPress={() => router.push("/me/profile")}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Avatar name={profile.full_name} url={profile.avatar_url} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: fs.xl, fontWeight: "800", color: color.ink }}>{profile.full_name}</Text>
            {/* Shown, never editable here: only admins change the join date, in the database. */}
            <Body muted style={{ fontSize: fs.sm }}>
              {profile.forum_joined_on ? `In the forum since ${long(profile.forum_joined_on)}` : "Forum date not set yet"}
              {profile.is_founding ? " · founding" : ""}
              {profile.is_admin ? " · admin" : ""}
            </Body>
          </View>
          <Text style={{ color: color.muted, fontSize: fs.xl }}>›</Text>
        </View>
      </Card>

      {note ? <Banner tone={note.ok ? color.green : color.amber}>{note.text}</Banner> : null}

      <Row
        title="WHOOP"
        detail={connected ? `Connected · synced ${whoop.last_sync_at ? ago(whoop.last_sync_at) : "never"}` : "Not connected · tap to connect"}
        right={connected ? <Text style={{ color: color.green }}>✓</Text> : null}
        onPress={connected ? undefined : connectWhoop}
      />
      <Row title="Notifications" detail={pushOn ? "On" : "Off"} onPress={notifications} />
      <Row title="Connect Claude (MCP)" detail="Use your forum in your own Claude" onPress={() => setMcpOpen((o) => !o)} />
      {mcpOpen ? (
        <Card>
          <Body>Add this connector URL in Claude, then sign in with your forum account. It sees only what you can see. There is no key to copy.</Body>
          <Text selectable style={{ color: color.blue, fontSize: fs.base, fontWeight: "700" }}>
            {MCP_URL}
          </Text>
          <Button ghost label="Copy URL" onPress={() => Clipboard.setStringAsync(MCP_URL).then(() => setNote({ ok: true, text: "Copied." }))} />
        </Card>
      ) : null}
      <Row title="Edit profile" onPress={() => router.push("/me/profile")} />

      {profile.is_admin ? (
        <View style={{ gap: 10 }}>
          <Eyebrow>Admin</Eyebrow>
          <Row title="Members and access" onPress={() => router.push("/me/members")} />
          <Row title="Seasons" onPress={() => router.push("/me/seasons")} />
        </View>
      ) : null}

      <Button ghost label={demo ? "Sign out (demo)" : "Sign out"} onPress={signOut} />
      <Body muted style={{ fontSize: fs.xs, textAlign: "center" }}>
        Version {config.appVersion} ({config.buildNumber})
      </Body>
    </Screen>
  );
}
