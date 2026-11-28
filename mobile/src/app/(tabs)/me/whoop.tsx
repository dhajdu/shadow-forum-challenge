import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
import { Banner, Body, Button, Card, Loading, Row, Screen, Small } from "@/components/ui";
import { UploadCard } from "@/components/zone";
import * as data from "@/data";
import { WHOOP_RESULT, whoopConnectUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { ago } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color } from "@/theme/tokens";

// /me/whoop — connection status, last sync, Connect / Reconnect / Disconnect, and the export upload.
export default function Whoop() {
  const { demo } = useAuth();
  const { whoop: result } = useLocalSearchParams<{ whoop?: string }>();
  const { data: d, loading, reload } = useLoad(async () => {
    const [w, ups] = await Promise.all([data.whoopStatus(), data.uploads()]);
    return { w, ups };
  });
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (result) setNote(WHOOP_RESULT[result] ?? WHOOP_RESULT.error);
  }, [result]);

  async function connect() {
    setNote(null);
    if (demo) return setNote({ ok: false, text: "Demo mode: nothing is connected." });
    try {
      const url = await whoopConnectUrl();
      if (!url) {
        await WebBrowser.openBrowserAsync(`${config.apiBaseUrl}/biometrics`);
        return reload();
      }
      // WHOOP's sign-in ends on shadowforum://me?whoop=<code>, which closes the sheet.
      const r = await WebBrowser.openAuthSessionAsync(url, "shadowforum://me");
      if (r.type === "success") setNote(WHOOP_RESULT[new URL(r.url).searchParams.get("whoop") ?? "error"] ?? WHOOP_RESULT.error);
      reload();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function disconnect() {
    setBusy(true);
    try {
      await data.disconnectWhoop();
      setNote({ ok: true, text: "WHOOP disconnected. Your past data stays." });
      setConfirm(false);
      reload();
    } catch (e) {
      setNote({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const on = d?.w.status === "connected";
  return (
    <Screen banner="me" back="Biometrics" title="WHOOP">
      {loading && !d ? <Loading /> : null}
      {note ? <Banner tone={note.ok ? color.green : color.amber}>{note.text}</Banner> : null}
      {d ? (
        <>
          <Row title={on ? "Connected" : "Not connected"} detail={on ? `Synced ${d.w.last_sync_at ? ago(d.w.last_sync_at) : "never"}` : "Connect to sync every morning"} right={on ? "●" : undefined} />
          {on ? (
            <>
              <Button ghost label="Reconnect" onPress={connect} />
              {confirm ? (
                <>
                  <Body muted>Disconnect stops the daily sync. Your past data stays.</Body>
                  <Button danger label="Disconnect WHOOP" onPress={disconnect} busy={busy} />
                  <Button ghost label="Keep it connected" onPress={() => setConfirm(false)} />
                </>
              ) : (
                <Button danger label="Disconnect" onPress={() => setConfirm(true)} />
              )}
            </>
          ) : (
            <Button label="Connect WHOOP" onPress={connect} />
          )}
          <Small>Data syncs every morning. A week without data marks you stale in the race.</Small>
          {d.ups.length ? (
            <Card title="Uploads">
              {d.ups.map((u) => (
                <Row key={u.id} title={u.file_name} detail={u.status} right={u.rows_ingested != null ? `${u.rows_ingested} rows` : undefined} />
              ))}
            </Card>
          ) : null}
          <UploadCard onDone={reload} />
        </>
      ) : null}
    </Screen>
  );
}
