import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Text } from "react-native";
import { Banner, Body, Button, Card, Screen, Small } from "@/components/ui";
import { config } from "@/lib/config";
import { color, font, fs } from "@/theme/tokens";

// /me/claude — the website's "MCP Connection" section: the connector URL, the steps, and what it can do.
const URL = `${config.apiBaseUrl}/api/mcp`;
const CLI = `claude mcp add --transport http shadow-forum ${URL}`;

export default function Claude() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (v: string, what: string) => Clipboard.setStringAsync(v).then(() => setCopied(what));
  return (
    <Screen banner="me" back="Me" title="Claude">
      <Body>Connect your own AI assistant, such as Claude, to the forum and ask it about agendas, the forum's topics, the kitty, the chat, the race and your goals.</Body>
      <Card title="Connector URL">
        <Text selectable style={{ color: color.blue, fontFamily: font.bold, fontSize: fs.base }}>
          {URL}
        </Text>
        <Button label="Copy URL" onPress={() => copy(URL, "URL")} />
      </Card>
      {copied ? <Banner tone={color.green}>{copied} copied.</Banner> : null}
      <Card title="In Claude">
        <Body>Settings → Connectors → Add custom connector → paste the URL → Connect, then sign in with your forum account and tap Allow.</Body>
      </Card>
      <Card title="In Claude Code">
        <Text selectable style={{ color: color.inkSoft, fontFamily: font.body, fontSize: fs.sm }}>
          {CLI}
        </Text>
        <Button ghost small label="Copy command" onPress={() => copy(CLI, "Command")} />
      </Card>
      <Card title="What it can do">
        <Body>Read forums and agendas from your first forum on, the forum's topics, the library, the kitty, the chat, the race, your goals and your WHOOP data.</Body>
        <Body>Act for you: add or void a kitty line, post to the chat, and set or update your own goals. It should check with you first.</Body>
        <Body>Never see another member's WHOOP data or anything from before your first forum, and never change access or admin settings.</Body>
      </Card>
      <Small>The connector runs as you, under the same rule as the app.</Small>
    </Screen>
  );
}
