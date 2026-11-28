import { useState } from "react";
import { Linking } from "react-native";
import { Banner, Body, Button, Card, Row, Screen, Small } from "@/components/ui";
import { permissionGranted, registerForPush } from "@/lib/push";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /me/notifications — one switch, then the five pushes the server sends. The lock screen shows
// only these words, never a message, a name or a score.
const KINDS = [
  { text: "Next forum: Wed 23 Dec, 6 pm", to: "Opens the forum" },
  { text: "A new agenda is in Forum", to: "Opens the recap" },
  { text: "New message in the forum chat", to: "Opens Chat" },
  { text: "The Whip: time to sync your WHOOP", to: "Opens Biometrics" },
  { text: "The November report is ready", to: "Opens the report" },
];

export default function Notifications() {
  const { data: on, reload } = useLoad(() => permissionGranted());
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  async function turnOn() {
    const r = await registerForPush(true);
    setNote(r.ok ? { ok: true, text: "Notifications are on." } : { ok: false, text: r.reason });
    reload();
  }
  return (
    <Screen banner="me" back="Me" title="Alerts">
      <Row title="Notifications" right={on ? "On" : "Off"} />
      {note ? <Banner tone={note.ok ? color.green : color.amber}>{note.text}</Banner> : null}
      {on ? <Button ghost label="Change in iPhone Settings" onPress={() => Linking.openSettings()} /> : <Button label="Turn on notifications" onPress={turnOn} />}
      <Card title="You'll get">
        {KINDS.map((k) => (
          <Row key={k.text} title={k.text} detail={k.to} />
        ))}
      </Card>
      <Body muted>The lock screen shows only these words. Never a message, a name or a score.</Body>
      <Small>A push about a forum goes only to members who can see that date.</Small>
    </Screen>
  );
}
