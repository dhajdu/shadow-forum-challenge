import Link from "next/link";
import type { Viewer } from "@/app/_data/forum";
import { AddPasskeyButton } from "@/components/AddPasskeyButton";
import s from "./me.module.css";

const MCP_URL = `${process.env.NEXT_PUBLIC_SITE_URL || "https://eoshadowforum.com"}/api/mcp`;

/** Account and admin links at the bottom of Me. */
export function Settings({ viewer }: { viewer: Viewer }) {
  return (
    <div className={s.grid}>
        <section className="zone-card">
          <h2>Account</h2>
          <ul className="rows">
            <li>
              <Link href="/me/profile" className="row">
                <span className="row-main"><b>Edit profile</b><small>Name, photo and password</small></span>
                <span className="chev" aria-hidden>→</span>
              </Link>
            </li>
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

        {viewer.is_admin && (
          <section className="zone-card">
            <h2>Admin</h2>
            <ul className="rows">
              <li>
                <Link href="/me/members" className="row">
                  <span className="row-main"><b>Members and access</b><small>First-forum dates, invites, preview as member</small></span>
                  <span className="chev" aria-hidden>→</span>
                </Link>
              </li>
              <li>
                <Link href="/me/seasons" className="row">
                  <span className="row-main"><b>Seasons</b><small>Contest seasons and their dates</small></span>
                  <span className="chev" aria-hidden>→</span>
                </Link>
              </li>
            </ul>
          </section>
        )}
    </div>
  );
}
