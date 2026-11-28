import { useState } from "react";
import { Alert, View } from "react-native";
import { Banner, Body, Button, Card, Empty, Field, Loading, Row, Screen, Seg, Tag } from "@/components/ui";
import * as data from "@/data";
import { long } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { color, fs } from "@/theme/tokens";

const STATUS_TONE: Record<data.MemberStatus, string> = { active: color.green, invited: color.amber, no_date: color.amber, left: color.muted };
const STATUS_LABEL: Record<data.MemberStatus, string> = { active: "active", invited: "invited", no_date: "no date", left: "left" };
const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);

// /me/members (admin). One date per member is the whole access setup. Every write goes through
// /api/admin/members, which checks the caller is an admin before calling set_member_access.
export default function Members() {
  const { data: list, error, loading, reload } = useLoad(() => data.members());
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(fn: () => Promise<void>, ok: string) {
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, text: ok });
      setOpen(null);
      setAdding(false);
      reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : String(e) });
    }
  }

  return (
    <Screen banner="me" back="Me" title="Members">
      {loading && !list ? <Loading /> : null}
      {error ? <Banner tone={color.red}>{error}</Banner> : null}
      {msg ? <Banner tone={msg.ok ? color.green : color.red}>{msg.text}</Banner> : null}
      {list && list.length === 0 ? <Empty>No members.</Empty> : null}
      {(list ?? []).map((m) => (
        <View key={m.id} style={{ gap: 8 }}>
          <Row
            title={m.full_name}
            detail={m.forum_left_on ? `Left ${long(m.forum_left_on)}` : m.forum_joined_on ? `First forum ${long(m.forum_joined_on)}` : "First forum not set"}
            right={
              <View style={{ flexDirection: "row", gap: 4 }}>
                {m.is_founding ? <Tag>founding</Tag> : null}
                <Tag tone={STATUS_TONE[m.status]}>{STATUS_LABEL[m.status]}</Tag>
              </View>
            }
            onPress={() => setOpen(open === m.id ? null : m.id)}
          />
          {open === m.id ? <Editor m={m} run={run} /> : null}
        </View>
      ))}
      {adding ? <Invite run={run} /> : <Button label="Add member" onPress={() => setAdding(true)} />}
      <Card title="Lark checklist">
        <Body muted style={{ fontSize: fs.sm }}>
          Outside the app: add a new member only to the Lark space that starts at their first forum (for example "2026/12 Forum"), never to older spaces.
        </Body>
      </Card>
    </Screen>
  );
}

type Run = (fn: () => Promise<void>, ok: string) => Promise<void>;

function Editor({ m, run }: { m: data.Member; run: Run }) {
  const [date, setDate] = useState(m.forum_joined_on ?? "");
  const [founding, setFounding] = useState(m.is_founding ? "yes" : "no");
  return (
    <Card>
      <Field label="First forum (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2027-01-27" autoCapitalize="none" />
      <Seg options={[{ key: "no", label: "Member" }, { key: "yes", label: "Founding (sees all)" }] as const} value={founding} onChange={setFounding} />
      <Button
        label="Save access"
        disabled={date !== "" && !isDay(date)}
        onPress={() => run(() => data.setMemberAccess({ id: m.id, forum_joined_on: date || null, is_founding: founding === "yes" }), `${m.full_name} updated.`)}
      />
      {m.status !== "left" ? (
        <Button
          ghost
          label="Remove from forum"
          onPress={() =>
            Alert.alert(`Remove ${m.full_name}?`, "They leave today and lose all access: agendas, contest and Ask.", [
              { text: "Cancel", style: "cancel" },
              { text: "Remove", style: "destructive", onPress: () => run(() => data.removeMember(m.id), `${m.full_name} removed.`) },
            ])
          }
        />
      ) : null}
    </Card>
  );
}

function Invite({ run }: { run: Run }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [date, setDate] = useState("");
  return (
    <Card title="Add member">
      <Field label="Name" value={name} onChangeText={setName} />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="First forum (YYYY-MM-DD, optional)" value={date} onChangeText={setDate} placeholder="Leave empty if not set" autoCapitalize="none" />
      <Body muted style={{ fontSize: fs.sm }}>
        They get an invite email. They see nothing until their first forum date is set, and only from that date on.
      </Body>
      <Button
        label="Send invite"
        disabled={!name.trim() || !email.includes("@") || (date !== "" && !isDay(date))}
        onPress={() => run(() => data.inviteMember({ full_name: name.trim(), email: email.trim(), forum_joined_on: date || null }), `Invite sent to ${email.trim()}.`)}
      />
    </Card>
  );
}
