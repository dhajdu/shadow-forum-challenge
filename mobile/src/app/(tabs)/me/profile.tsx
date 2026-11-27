import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Head } from "@/components/Head";
import { Banner, Body, Button, Field, Loading, Screen } from "@/components/ui";
import * as data from "@/data";
import { long } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /me/profile — name and photo are the only things a member can change about themselves.
export default function Profile() {
  const { data: p, error, loading, reload } = useLoad(() => data.myProfile());
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => {
    if (p) setName(p.full_name);
  }, [p]);

  async function run(fn: () => Promise<void>, ok: string) {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
    setBusy(false);
  }

  async function pickPhoto() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.7 });
    const a = r.canceled ? null : r.assets[0];
    if (a) await run(() => data.updateAvatar(a.uri, a.mimeType ?? "image/jpeg"), "Photo updated.");
  }

  return (
    <Screen>
      <Head back="Me" title="Profile" />
      {loading && !p ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {p ? (
        <>
          <View style={{ alignItems: "center", gap: 10 }}>
            <Avatar name={p.full_name} url={p.avatar_url} size={88} />
            <Button ghost label="Change photo" onPress={pickPhoto} busy={busy} />
          </View>
          <Field label="Name" value={name} onChangeText={setName} autoComplete="name" />
          <Button label="Save" busy={busy} disabled={!name.trim() || name.trim() === p.full_name} onPress={() => run(() => data.updateName(name.trim()), "Saved.")} />
          {msg ? <Banner tone={msg.ok ? color.green : color.red}>{msg.text}</Banner> : null}
          <Body muted>
            {p.forum_joined_on ? `In the forum since ${long(p.forum_joined_on)}.` : "Your first forum date isn't set yet."} Only an admin can change this.
          </Body>
        </>
      ) : null}
    </Screen>
  );
}
