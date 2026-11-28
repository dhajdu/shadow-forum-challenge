import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { Avatar } from "@/components/Avatar";
import { Banner, Body, Button, Card, Field, Loading, Row, Screen } from "@/components/ui";
import * as data from "@/data";
import { useAuth } from "@/lib/auth";
import { long } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /me/profile — Account: photo, name and password. Name and photo are the only profile fields a
// member can change; the first-forum date is shown, never editable. Blocked members can be
// unblocked here, and the account deleted (App Store guideline 5.1.1(v)).
export default function Profile() {
  const { data: p, error, loading, reload } = useLoad(() => data.myProfile());
  const { data: email } = useLoad(() => data.myEmail());
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { data: blocked, reload: reloadBlocked } = useLoad(() => data.blockedMembers());
  const { signOut } = useAuth();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);

  async function deleteAccount() {
    setDeleting(true);
    setDeleteErr(null);
    try {
      await data.deleteAccount();
      await signOut("Your account and data were deleted.");
    } catch (e) {
      setDeleteErr(e instanceof Error ? e.message : String(e));
      setDeleting(false);
    }
  }
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
    <Screen banner="me" back="Me" title="Account">
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
          {email ? <Row title="Email" right={email} /> : null}
          <Card title="Password">
            <Field placeholder="New password (6+ characters)" value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            <Field placeholder="Type it again" value={pw2} onChangeText={setPw2} secureTextEntry autoComplete="new-password" textContentType="newPassword" />
            {pw2 && pw !== pw2 ? <Body muted>The two passwords don't match.</Body> : null}
            <Button
              ghost
              label="Change password"
              busy={busy}
              disabled={pw.length < 6 || pw !== pw2}
              onPress={() =>
                run(async () => {
                  await data.changePassword(pw);
                  setPw("");
                  setPw2("");
                }, "Password changed.")
              }
            />
          </Card>
          <Body muted>
            {p.forum_joined_on ? `In the forum since ${long(p.forum_joined_on)}.` : "Your first forum date isn't set yet."} Only an admin can change this.
          </Body>
          {blocked?.length ? (
            <Card title="Blocked members">
              {blocked.map((b) => (
                <Row key={b.id} title={b.full_name} right="Unblock" onPress={() => run(() => data.unblockMember(b.id).then(() => reloadBlocked()), "Unblocked.")} />
              ))}
            </Card>
          ) : null}
          <Card title="Delete account">
            {confirmDelete ? (
              <>
                <Body muted>
                  This deletes your account, your WHOOP data, chat messages, photos, goals and Ask AI conversations now. It can't be undone. The kitty ledger keeps its amounts without your name.
                </Body>
                {deleteErr ? <Banner tone={color.red}>{deleteErr}</Banner> : null}
                <Button danger label="Delete my account and data" onPress={deleteAccount} busy={deleting} />
                <Button ghost label="Keep my account" onPress={() => setConfirmDelete(false)} disabled={deleting} />
              </>
            ) : (
              <Button danger label="Delete my account" onPress={() => setConfirmDelete(true)} />
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}
