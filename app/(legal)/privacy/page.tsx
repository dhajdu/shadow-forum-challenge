import type { Metadata } from "next";
import { getForumSettings } from "@/lib/forum-settings";
import { CONTACT_EMAIL, LEGAL_UPDATED, OPERATOR } from "@/shared/legal";

export const metadata: Metadata = { title: "Privacy policy" };

// Written from the code: tables in supabase/migrations, processors in lib/ and app/api/.
// Change it when what the app stores or sends changes.
export default async function Privacy() {
  const forum = await getForumSettings();
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
  return (
    <>
      <header className="page-head">
        <div className="eyebrow">{forum.name}</div>
        <h1>Privacy policy</h1>
        <p className="sub">Updated {LEGAL_UPDATED}</p>
      </header>
      <div className="prose">
        <h2>Who runs it</h2>
        <p>
          The {forum.name} website and iPhone app are run by {OPERATOR}, the forum&apos;s moderator, for the members of a
          private forum of the Entrepreneurs&apos; Organization. Membership is by invitation only. For anything about your
          data, email {mail}.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li><b>Account.</b> Your name, email address and password (kept by our sign-in provider, never in readable form), any passkey you add, your profile photo, the date of your first forum and, if you leave, your last, and when you last used the app.</li>
          <li><b>WHOOP data.</b> If you connect WHOOP or upload a WHOOP export: your daily score, recovery, strain, sleep, heart rate variability (HRV) and resting heart rate, your WHOOP journal answers, the export files you upload, and the WHOOP sign-in tokens that let the daily sync run. The app does not use Apple Health.</li>
          <li><b>What you post.</b> Chat messages and the photos in them, forum gallery photos and captions, your questions to Ask AI and its answers, your business goal, its progress and check-ins, your personal goals, coaching notes, and your Constitution signature (the name you type, the time, your IP address and your browser or device type).</li>
          <li><b>Forum records.</b> Agendas and recaps, forum dates, the year&apos;s roles, the forum&apos;s kitty ledger (amounts members owe and have paid in, and what the kitty spent) and contest penalties.</li>
          <li><b>Your phone.</b> A push notification token, the platform and the app version, so we can send you notifications.</li>
          <li><b>Calendar.</b> Write only. When you tap to add the next forum, the app adds that one event to your calendar. It never reads your calendar.</li>
          <li><b>Reports and blocks.</b> If you report a chat message, we keep the report and a copy of the message as it was. If you block a member, we keep that so your app can hide their messages.</li>
          <li><b>Sign-up attempts.</b> When someone joins with an access code we record the IP address, to stop guessing. These records are deleted after a day.</li>
        </ul>
        <p>There are no ads, no analytics or crash-reporting tools, and no tracking. We do not collect your location or contacts, and we never sell or share your data for advertising.</p>

        <h2>Why</h2>
        <p>
          Only to run the forum for its members: sign you in, show the forum&apos;s agendas, chat and photos, run the
          contest between members (Race Into the Shadow and the goal contest), keep the kitty&apos;s ledger, answer your Ask AI
          questions, send notifications, and keep the chat safe.
        </p>

        <h2>Who sees it</h2>
        <ul>
          <li><b>Forum members</b> (active members only) see your name and photo, your chat messages and gallery photos, your business goal and check-ins, your contest place and penalties, the kitty ledger, and, on your rider page, your daily contest numbers for the contest seasons they can see: score, recovery, sleep, strain, resting heart rate and HRV. Agendas and other forum records are shown from each member&apos;s first forum on.</li>
          <li><b>Your coach</b> (the member assigned to coach you) also sees your goal progress and the coaching notes about you.</li>
          <li><b>Forum admins</b> also see every member&apos;s email address and access dates, reported messages, and they can remove messages and end a member&apos;s access.</li>
          <li><b>Only you</b> see your WHOOP journal answers, your weekly analysis, your Ask AI conversations, your personal goals and your uploads.</li>
        </ul>
        <p>Notifications never show a message, a name or a score: they say only that something is new.</p>

        <h2>Service providers</h2>
        <p>We use these companies to run the app. Each handles your data only to provide its service to us.</p>
        <ul>
          <li><b>Supabase</b> stores the database, the files (photos, WHOOP exports) and handles sign-in.</li>
          <li><b>Vercel</b> hosts the website and its server.</li>
          <li><b>Anthropic</b> provides the AI model behind Ask AI. When you ask a question, your question, the recent turns of that conversation and the excerpts from the agendas you are allowed to see are sent to Anthropic&apos;s API to write the answer. The biometrics assistant sends your messages and your own WHOOP numbers. Once a week the Analyst sends each member&apos;s WHOOP journal answers and daily scores, one member at a time, to write that member&apos;s weekly analysis. Nothing is sent about what you cannot see.</li>
          <li><b>Resend</b> sends email: the monthly contest report, data reminders, and report alerts to admins.</li>
          <li><b>Expo</b> and <b>Apple</b> deliver push notifications to your phone, using your push token.</li>
          <li><b>WHOOP</b>, if you connect it: we receive your data from WHOOP under WHOOP&apos;s own terms. Disconnecting stops the sync.</li>
        </ul>

        <h2>How long we keep it</h2>
        <p>
          As long as you have an account. Leaving the forum ends your access but does not delete your data; deleting your
          account does. Sign-up attempts are deleted after a day.
        </p>

        <h2>Deleting your account</h2>
        <p>
          In the iPhone app, open <b>Me &gt; Account and password &gt; Delete my account</b> and confirm. You can also email {mail}{" "}
          and we will delete it for you. Deleting removes your account, profile, WHOOP data and connection, uploads, chat
          messages, photos, goals, notes, Ask AI conversations, signatures and devices straight away. Two things stay,
          without your name: the kitty ledger&apos;s amounts (the forum&apos;s accounts must still add up) and reports other members
          made about messages you posted. Copies in our providers&apos; backups are overwritten as those backups expire.
        </p>

        <h2>Your rights</h2>
        <p>Email {mail} to see, correct or get a copy of your data, or to ask any question about it. We reply within 30 days.</p>

        <h2>Children</h2>
        <p>The app is for the forum&apos;s adult members only.</p>

        <h2>Changes</h2>
        <p>If this policy changes, the new version is posted here with a new date, and members are told in the app.</p>
      </div>
    </>
  );
}
