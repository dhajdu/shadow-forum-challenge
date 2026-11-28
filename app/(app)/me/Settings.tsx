import { AddPasskeyButton } from "@/components/AddPasskeyButton";
import { CopyButton } from "@/components/CopyButton";
import s from "./me.module.css";

const MCP_URL = `${process.env.NEXT_PUBLIC_SITE_URL || "https://eoshadowforum.com"}/api/mcp`;
const CLAUDE_CODE = `claude mcp add --transport http shadow-forum ${MCP_URL}`;

const EXAMPLES = [
  "What did I commit to at the last forum?",
  "What's in the Parking Lot for the next forum?",
  "How much is in the kitty, and who still owes dues for the last forum?",
  "How has my recovery trended this month?",
];

/** Account settings and the MCP connection on Profile. Admin tools live on Members and access only. */
export function Settings() {
  return (
    <div className={s.settings}>
      <section className="zone-card">
        <h2>Account</h2>
        <ul className="rows">
          <li className="row">
            <span className="row-main"><b>Notifications</b><small>Forum dates and new agendas, by push in the iPhone app</small></span>
            <span className="tag">soon</span>
          </li>
          <li className="row">
            <span className="row-main"><b>Passkeys</b><small>Sign in with Face ID or Touch ID</small></span>
            <span className={s.passkey}><AddPasskeyButton /></span>
          </li>
        </ul>
      </section>

      <section className="zone-card" id="mcp">
        <h2>MCP Connection</h2>
        <p className={s.lede}>
          Connect your own AI assistant, such as Claude, to the forum database and ask it about agendas, the Parking Lot, the kitty, the chat,
          goals, the race and your WHOOP data. It signs in as you, so it sees only what you can see here. There is no shared key.
        </p>

        <div className={s.urlRow}>
          <code className={s.url}>{MCP_URL}</code>
          <CopyButton value={MCP_URL} label="Copy URL" />
        </div>

        <h3 className={s.step}>Claude (web, desktop and phone)</h3>
        <ol className={s.steps}>
          <li>In Claude, open <b>Settings → Connectors</b> and choose <b>Add custom connector</b>.</li>
          <li>Name it <b>The Shadow Forum</b> and paste the URL above.</li>
          <li>Click <b>Connect</b>. This site opens: sign in with your forum account and choose <b>Allow</b>.</li>
          <li>In a chat, turn on <b>The Shadow Forum</b> in the tools menu and ask away. It works on every device signed in to the same Claude account.</li>
        </ol>

        <h3 className={s.step}>Claude Code</h3>
        <div className={s.urlRow}>
          <code className={s.url}>{CLAUDE_CODE}</code>
          <CopyButton value={CLAUDE_CODE} label="Copy" />
        </div>
        <p className="note-line">Run it in a terminal, then type <code className={s.code}>/mcp</code> in Claude Code and sign in when the browser opens.</p>

        <h3 className={s.step}>Other assistants</h3>
        <p className="note-line">Any app that supports remote MCP servers with OAuth sign-in can use the same URL.</p>

        <h3 className={s.step}>Try asking</h3>
        <ul className={s.examples}>
          {EXAMPLES.map((q) => (
            <li key={q}>&ldquo;{q}&rdquo;</li>
          ))}
        </ul>

        <h3 className={s.step}>What it can do</h3>
        <ul className={s.can}>
          <li><b>Read</b> forums and agendas from your first forum on, the Parking Lot, the library, the kitty, the chat, the race, your goals and your WHOOP data.</li>
          <li><b>Act for you</b>: add or void a kitty line, post to the chat, and set or update your own goals. It should check with you first; you can also block these tools in your assistant&apos;s settings.</li>
          <li><b>Never</b> see another member&apos;s WHOOP data or anything from before your first forum, and never change access or admin settings.</li>
        </ul>
        <p className="note-line">To disconnect, remove the connector in your assistant&apos;s settings. Signing out here does not disconnect it. If you leave the forum, the connection stops working.</p>
      </section>
    </div>
  );
}
