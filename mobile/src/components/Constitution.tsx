// The Constitution: version, what changed, the full text, signatures, and the sign form while the
// member hasn't signed the newest version. Used by the launch gate and by Resources → Constitution.
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Markdown } from "@/components/Markdown";
import { Banner, Body, Button, Card, Display, Eyebrow, Field, Loading, Row, Small } from "@/components/ui";
import * as data from "@/data";
import { long } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, font, fs } from "@/theme/tokens";

export function ConstitutionView({ onSigned, gate }: { onSigned?: () => void; gate?: boolean }) {
  const { data: c, error, reload } = useLoad(async () => {
    const [con, me, ppl] = await Promise.all([data.constitution(), data.myProfile(), data.people()]);
    return { con, me, ppl };
  });
  const [name, setName] = useState<string | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(!gate);

  if (error) return <Banner tone={color.red}>{error}</Banner>;
  if (!c) return <Loading />;
  const { current, versions, signatures, mine } = c.con;
  if (!current) return <Body muted>There is no Constitution to sign yet.</Body>;
  const signedNow = signatures.filter((s) => s.version_id === current.id);
  const previous = versions[1];
  const signedBefore = previous && signatures.some((s) => s.version_id === previous.id && s.user_id === c.me.id);
  const typed = name ?? c.me.full_name;

  async function sign() {
    setBusy(true);
    setErr(null);
    try {
      await data.signConstitution(typed.trim(), current!.sha256);
      await reload();
      onSigned?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 14 }}>
      <Small>
        Version {current.version} · in force since {long(current.published_at.slice(0, 10))} · {signedNow.length} signed
      </Small>
      {mine ? (
        <Small tone={color.green}>
          You signed version {current.version} on {long(mine.signed_at.slice(0, 10))} as {mine.typed_name}.
        </Small>
      ) : (
        <Banner tone={color.amber}>{signedBefore ? `You signed version ${previous.version}. Read what changed and sign version ${current.version}.` : "You haven't signed yet. Read it and sign below."}</Banner>
      )}
      {current.change_note && current.version > 1 ? (
        <Card title={`What changed in version ${current.version}`}>
          <Body>{current.change_note}</Body>
        </Card>
      ) : null}
      <Card title="The Constitution">
        {showAll ? <Markdown text={current.body_md} /> : <Button ghost small label="Read the full text" onPress={() => setShowAll(true)} />}
      </Card>
      {!mine ? (
        <Card title={`Sign version ${current.version}`}>
          <Field label="Type your full name to sign" value={typed} onChangeText={setName} autoCapitalize="words" autoComplete="name" />
          {typed.trim().length >= 2 ? <Text style={{ fontFamily: font.display, fontSize: fs.xl2, color: color.inkSoft, fontStyle: "italic" }}>{typed.trim()}</Text> : null}
          <Pressable onPress={() => setAgree(!agree)} accessibilityRole="checkbox" accessibilityState={{ checked: agree }} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
            <Text style={{ color: agree ? color.green : color.muted, fontSize: fs.xl }}>{agree ? "☑" : "☐"}</Text>
            <Body style={{ flex: 1 }}>{data.consentText(current.version)}</Body>
          </Pressable>
          {err ? <Banner tone={color.red}>{err}</Banner> : null}
          <Button label="Sign the Constitution" onPress={sign} busy={busy} disabled={!agree || typed.trim().length < 2} />
          <Small>We keep the typed name, the time, your device and a fingerprint of the text, as the website does.</Small>
        </Card>
      ) : null}
      {!gate ? (
        <Card title="Signatures">
          {signedNow.map((s) => (
            <Row key={s.user_id} title={s.typed_name} right={long(s.signed_at.slice(0, 10))} />
          ))}
          {versions.length > 1 ? <Eyebrow>Earlier versions</Eyebrow> : null}
          {versions.slice(1).map((v) => (
            <Row key={v.id} title={`Version ${v.version}`} detail={v.change_note} right={`${signatures.filter((s) => s.version_id === v.id).length} signed`} />
          ))}
        </Card>
      ) : null}
    </View>
  );
}

export function ConstitutionTitle() {
  return <Display size={44}>Approved Constitution</Display>;
}
