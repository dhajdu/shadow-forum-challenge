import { Redirect, router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Text, View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Banner, Button, Display, Eyebrow, Loading, Row, Screen, Small } from "@/components/ui";
import * as data from "@/data";
import { useAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { ago, long } from "@/lib/format";
import { permissionGranted } from "@/lib/push";
import { useLoad } from "@/lib/useLoad";
import { color, font, fs } from "@/theme/tokens";

// /me — who you are and since when, then your own things. The admin block shows only for admins.
// The join date is shown, never editable here: only admins change it.
export default function Me() {
  const { signOut, demo } = useAuth();
  const { whoop } = useLocalSearchParams<{ whoop?: string }>();
  const { data: d, error, loading } = useLoad(async () => {
    const [profile, w, pushOn] = await Promise.all([data.myProfile(), data.whoopStatus(), permissionGranted()]);
    return { profile, w, pushOn };
  });
  // WHOOP's sign-in ends on shadowforum://me?whoop=<code>; the result is shown on the WHOOP screen.
  if (whoop) return <Redirect href={{ pathname: "/me/whoop", params: { whoop } }} />;
  if (loading && !d) return <Screen banner="me" title="Me"><Loading /></Screen>;
  if (error || !d) return <Screen banner="me" title="Me"><Banner tone={color.red}>{error ?? "Nothing to show."}</Banner></Screen>;
  const { profile, w, pushOn } = d;

  return (
    <Screen banner="me" title="Me">
      <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
        <Avatar name={profile.full_name} url={profile.avatar_url} size={56} />
        <View style={{ flex: 1 }}>
          <Display size={30}>{profile.full_name}</Display>
          <Small>
            {profile.is_founding ? "Founding member" : profile.forum_joined_on ? `Member · in the forum since ${long(profile.forum_joined_on)}` : "Member"}
            {profile.is_admin ? " · admin" : ""}
          </Small>
        </View>
      </View>
      <View>
        <Row title="Biometrics" detail={w.status === "connected" ? `WHOOP synced ${w.last_sync_at ? ago(w.last_sync_at) : "never"}` : "Connect WHOOP"} onPress={() => router.push("/me/biometrics")} />
        <Row title="Account and password" detail="Photo, name, password, delete account" onPress={() => router.push("/me/profile")} />
        <Row title="Notifications" detail={pushOn ? "On" : "Off"} onPress={() => router.push("/me/notifications")} />
        <Row title="Connect Claude" detail="Use the forum from your own Claude" onPress={() => router.push("/me/claude")} />
      </View>
      {profile.is_admin ? (
        <View>
          <Eyebrow>Admin</Eyebrow>
          <Row title="Members and access" onPress={() => router.push("/me/members")} />
          <Small style={{ marginTop: 6 }}>Preview as member, Seasons and amending the Constitution are on the website.</Small>
        </View>
      ) : null}
      <View>
        <Row title="Support" detail="Help, reporting, deleting your account" onPress={() => WebBrowser.openBrowserAsync(`${config.apiBaseUrl}/support`)} />
        <Row title="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(`${config.apiBaseUrl}/privacy`)} />
        <Row title="Terms of use" onPress={() => WebBrowser.openBrowserAsync(`${config.apiBaseUrl}/terms`)} />
      </View>
      <Button ghost label={demo ? "Sign out (demo)" : "Sign out"} onPress={() => signOut()} />
      <Text style={{ color: color.muted, fontFamily: font.body, fontSize: fs.xs, textAlign: "center" }}>
        Version {config.appVersion} ({config.buildNumber})
      </Text>
    </Screen>
  );
}
