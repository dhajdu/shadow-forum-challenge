import Link from "next/link";
import { redirect } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { longDay } from "@/app/_data/format";
import { WhoopConnect, whoopNotice } from "@/app/(app)/contest/goal/WhoopConnect";
import { isExternallySynced } from "@/lib/whoop/config";
import { AddPasskeyButton } from "@/components/AddPasskeyButton";
import { SignOutButton } from "@/components/SignOutButton";
import s from "./me.module.css";

const MCP_URL = `${process.env.NEXT_PUBLIC_SITE_URL || "https://eoshadowforum.com"}/api/mcp`;

export default async function MePage({ searchParams }: { searchParams: Promise<{ whoop?: string; upload?: string }> }) {
  const params = await searchParams;
  // old "Upload WHOOP" links pointed at /me?upload=1; the upload now sits on My goal
  if (params.upload != null) redirect("/contest/goal?upload=1");

  const { db, user, viewer } = await getForumContext();
  const [{ data: profile }, connection] = await Promise.all([
    db.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle(),
    db.from("whoop_connection_status").select("status, last_sync_at, last_error").eq("user_id", user.id).maybeSingle(),
  ]);
  const avatar = (profile as { avatar_url: string | null } | null)?.avatar_url ?? null;
  const initials = viewer.full_name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="page">
      <header className={s.head}>
        <div className={s.avatar} style={avatar ? { backgroundImage: `url(${avatar})` } : undefined}>
          {avatar ? null : initials}
        </div>
        <div>
          <div className="eyebrow">Me</div>
          <h1>{viewer.full_name}</h1>
          <p className="note-line">
            {viewer.forum_joined_on ? `In the forum since ${longDay(viewer.forum_joined_on)}` : "First forum date not set yet"}
            {viewer.is_admin ? " · admin" : ""}
          </p>
        </div>
      </header>

      <div className={s.grid}>
        <section className="zone-card">
          <h2>WHOOP</h2>
          <p className="note-line">Your scores for the contest sync from WHOOP. The CSV upload on My goal stays as a fallback.</p>
          <div className={s.whoop}>
            <WhoopConnect
              status={connection.error ? null : (connection.data?.status ?? null)}
              lastSync={connection.error ? null : (connection.data?.last_sync_at ?? null)}
              lastError={connection.error ? null : (connection.data?.last_error ?? null)}
              external={isExternallySynced(user.id)}
              notice={whoopNotice(params.whoop)}
            />
          </div>
        </section>

        <section className="zone-card">
          <h2>Account</h2>
          <ul className="rows">
            <li>
              <Link href="/me/profile" className="row">
                <span className="row-main"><b>Edit profile</b><small>Name, photo and password</small></span>
                <span className="chev" aria-hidden>›</span>
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
          <div className="signout-row">
            <SignOutButton className="btn-ghost" />
          </div>
        </section>

        {viewer.is_admin && (
          <section className="zone-card">
            <h2>Admin</h2>
            <ul className="rows">
              <li>
                <Link href="/me/members" className="row">
                  <span className="row-main"><b>Members and access</b><small>First-forum dates, invites, preview as member</small></span>
                  <span className="chev" aria-hidden>›</span>
                </Link>
              </li>
              <li>
                <Link href="/me/seasons" className="row">
                  <span className="row-main"><b>Seasons</b><small>Contest seasons and their dates</small></span>
                  <span className="chev" aria-hidden>›</span>
                </Link>
              </li>
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
