import Link from "next/link";
import type { Metadata } from "next";
import { getForumSettings } from "@/lib/forum-settings";
import { CONTACT_EMAIL, OPERATOR } from "@/shared/legal";

export const metadata: Metadata = { title: "Support" };

export default async function Support() {
  const forum = await getForumSettings();
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">{forum.name}</div>
        <h1>Support</h1>
      </header>
      <div className="prose">
        <h2>Get help</h2>
        <p>
          Email {mail}. {OPERATOR}, the forum&apos;s moderator, answers, usually within a day. Say what you were doing, on
          the website or the iPhone app, and include a screenshot if you can.
        </p>

        <h2>Can&apos;t sign in</h2>
        <p>
          Use <b>Forgot password?</b> on the <Link href="/">sign-in page</Link> to get a reset link. If the app says your access is
          still being set up, an admin has not set the date of your first forum yet: email {mail}.
        </p>

        <h2>Report a message or a member</h2>
        <p>
          In the chat, press and hold the message, then tap <b>Report</b> or <b>Block</b>. Reports go to the forum&apos;s admins,
          who review them within 24 hours. You can also email {mail}.
        </p>

        <h2>Delete your account</h2>
        <p>
          In the iPhone app, open <b>Me &gt; Account and password</b>, tap <b>Delete my account</b> and confirm. Your account
          and data are deleted straight away, as the <Link href="/privacy">privacy policy</Link> describes. Or email {mail} from
          the address you sign in with and we will delete it for you.
        </p>

        <p>
          <Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms of use</Link>
        </p>
      </div>
    </>
  );
}
