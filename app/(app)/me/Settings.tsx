import { AddPasskeyButton } from "@/components/AddPasskeyButton";
import s from "./me.module.css";

const MCP_URL = `${process.env.NEXT_PUBLIC_SITE_URL || "https://eoshadowforum.com"}/api/mcp`;

/** Account settings on Profile. Admin tools live on Members and access only. */
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
              <span className="row-main">
                <b>Connect Claude (MCP)</b>
                <small>Add <code className={s.code}>{MCP_URL}</code> as a connector in Claude, then sign in here. No key to copy; it sees only what you see, read-only.</small>
              </span>
            </li>
            <li className="row">
              <span className="row-main"><b>Passkeys</b><small>Sign in with Face ID or Touch ID</small></span>
              <span className={s.passkey}><AddPasskeyButton /></span>
            </li>
          </ul>
        </section>

    </div>
  );
}
