import Link from "next/link";
import type { Metadata } from "next";
import { getForumSettings } from "@/lib/forum-settings";
import { CONTACT_EMAIL, LEGAL_UPDATED, OPERATOR } from "@/shared/legal";

export const metadata: Metadata = { title: "Terms of use" };

export default async function Terms() {
  const forum = await getForumSettings();
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">{forum.name}</div>
        <h1>Terms of use</h1>
        <p className="sub">Updated {LEGAL_UPDATED}</p>
      </header>
      <div className="prose">
        <p>
          These terms cover the {forum.name} website and iPhone app, run by {OPERATOR} for the members of the forum. By
          using them you agree to these terms and to the <Link href="/privacy">privacy policy</Link>.
        </p>

        <h2>Membership</h2>
        <p>
          The app is for the forum&apos;s members only, by invitation. You join with the forum&apos;s access code, and the
          forum&apos;s admins decide who has access and from which date. Keep your sign-in to yourself. Admins can end a
          member&apos;s access at any time.
        </p>

        <h2>Acceptable use</h2>
        <ul>
          <li>What is said in the forum stays in the forum. Do not copy or share another member&apos;s messages, photos, numbers or agenda content outside it.</li>
          <li>Post only what you have the right to share, and only photos of people who are happy to be in them.</li>
          <li>Do not try to reach data the app does not show you, or get in the way of the service.</li>
        </ul>

        <h2>No abusive content</h2>
        <p>
          There is no tolerance for abusive, harassing, hateful, sexual, threatening or otherwise objectionable content, or
          for abusive members. In the chat, press and hold any message to <b>Report</b> it or <b>Block</b> its author.
          Blocking hides that member&apos;s messages from you. Every report goes to the forum&apos;s admins straight away. They
          review it within 24 hours, remove content that breaks these terms, and remove members who post it. You can also
          report anything by email to {mail}.
        </p>

        <h2>The kitty and penalties</h2>
        <p>
          The kitty and the contest penalties are a record of what members have agreed to contribute to the forum. No
          money is paid, collected or moved in the app. Members settle amounts between themselves, outside the app.
        </p>

        <h2>Not medical advice</h2>
        <p>
          WHOOP numbers, scores, the weekly analysis and Ask AI answers are for the forum&apos;s contest and your own
          interest. They are not medical advice. Talk to a doctor about your health. Ask AI can be wrong: check what
          matters against the agendas themselves.
        </p>

        <h2>Your content</h2>
        <p>
          What you post stays yours. You let the forum show it to its members, as the privacy policy describes, for as
          long as it is in the app.
        </p>

        <h2>Deleting your account</h2>
        <p>
          You can delete your account at any time in the iPhone app (Me &gt; Account and password &gt; Delete my account) or
          by emailing {mail}. See the <Link href="/privacy">privacy policy</Link> for what is removed.
        </p>

        <h2>The service</h2>
        <p>
          The app is run for the forum on a best-effort basis, without warranties. It may change, pause or stop. As far as
          the law allows, {OPERATOR} is not liable for losses from using it.
        </p>

        <h2>Changes and contact</h2>
        <p>If these terms change, the new version is posted here with a new date. Questions: {mail}.</p>
      </div>
    </>
  );
}
