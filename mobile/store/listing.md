# App Store listing: The Shadow Forum

Status 28 Nov 2026: draft, not yet entered in App Store Connect (app 6840256415). Three blockers must be fixed before Submit for Review (no privacy policy page, no account deletion, no report or block in Chat; see Open questions). Dave checks the wording, then it is pasted in. The reviewer account and Apple's account declarations are Dave's.

Everything App Store Connect asks for, ready to paste. Bundle ID `com.talentedge.shadowforum` (plus `com.talentedge.shadowforum.share-extension` and `com.talentedge.shadowforum.widget`), primary language English (U.S.), team MYBR59DBU2. Version 1.0, attach build 3 (27 Nov 2026). Distribution: unlisted (see Unlisted distribution).

## App information

- **Name:** The Shadow Forum
- **Subtitle:** Private forum, race and chat
- **Category:** Business (secondary: Health & Fitness)
- **Age rating:** every content question "None", except "Unrestricted web access: No", "User-generated content: Yes" and "Messaging and chat: Yes" (one group chat for the forum's members), "Health or wellness topics: Yes" (WHOOP recovery, sleep and strain), and "Contests: Yes" (Race Into the Shadow, a fitness contest between members; no money moves in the app). Apple will likely rate it 12+ or higher on the chat answer; accept what it gives.
- **Support URL:** none yet. https://eoshadowforum.com/support and /contact return 404. Use https://eoshadowforum.com only if Dave adds a contact line to it.
- **Marketing URL:** https://eoshadowforum.com
- **Privacy policy URL:** none yet. **Apple requires one.** https://eoshadowforum.com/privacy returns 404. Publish a page (for example /privacy) and paste it here.
- **Copyright:** 2026 [legal entity, to confirm]

## Description

The Shadow Forum is the private app for the members of The Shadow Forum, an Entrepreneurs' Organization forum.

Know when you meet. The next forum fills Home with the date, time and place, and goes into your calendar in a tap. Before it, read the plan; after it, the recap. Every agenda from your first forum on, with search.

Race Into the Shadow. The season's contest ranks every rider on their average daily WHOOP score, a blend of recovery, sleep and strain. See the standings, open any rider, read the monthly report and check the penalties before the kitty settles. Connect your WHOOP account for a daily sync, or share your WHOOP export to the app from the share sheet.

Your numbers stay yours. Biometrics shows your latest day, your trends, your monthly averages and a weekly read of your WHOOP journal. No other member sees them.

Your goal. Set your business goal for the season, move its progress before your monthly coaching call, and keep your personal goals next to it.

The forum between forums:
- One group chat, with threads.
- The kitty: the forum's own ledger, all year.
- Photos from every forum.
- Topics members asked to bring back, and the forum's resources.

Ask AI about agendas, what you committed to or your own data. It sees only what you can see. You can also connect your own AI assistant, such as Claude, to the forum.

Widgets show your place and the race's top three on the Home Screen and the Lock Screen. Notifications say only that something is new: never a message, a name or a score.

The app is by invitation only and uses the same sign-in as eoshadowforum.com. You see the forum from the day you joined.

## Keywords

EO,forum,accountability,race,recovery,sleep,strain,agenda,kitty,members,private,goals,coach,chat

(100 characters max, no spaces after commas. Count: 96. Low priority: the app is unlisted, so it never shows in search. WHOOP is left out because Apple rejects other companies' trademarks in keywords.)

## Promotional text

The next forum, Race Into the Shadow and the forum chat in one place. By invitation only, and you see the forum from the day you joined.

## App Privacy (data types collected, all linked to the user, none used for tracking)

- **Contact info:** name, email address. App functionality.
- **Health & Fitness:** health (recovery, resting heart rate, HRV, WHOOP journal answers) and fitness (daily WHOOP score, sleep, strain). From the WHOOP connection or an uploaded WHOOP export. App functionality.
- **User content:** photos (profile photo, forum gallery), other user content (chat messages, Ask AI conversations, goals and goal progress notes, kitty lines, Constitution signature). App functionality.
- **Identifiers:** user ID; device ID (the push token). App functionality.
- **Usage data:** none. **Diagnostics:** none (no crash or analytics SDK in `mobile/package.json`). **Location, contacts, browsing history, search history, purchases, sensitive info:** none. The calendar is write-only (one event the member confirms) and nothing is read back. **Financial info:** see Open questions (the kitty records amounts owed between members).

## App Review information

- **Sign-in required:** yes. There is no sign-up in the app: members join on the website with the forum's access code, sign the Constitution, and an admin sets their first-forum date. Create a review account the same way for `appreview@eoshadowforum.com` (address to confirm) with a password, set its first-forum date in Me > Members and access, sign the Constitution once on the website so the app opens straight onto Home, and paste the email and password here. A non-founding account with no first-forum date is signed out with "Your access is still being set up".
- **Notes for the reviewer:**
  This app is intended for unlisted distribution. It is for the members of The Shadow Forum, a private Entrepreneurs' Organization forum of seven members, and is shared with them by direct link.
  Accounts are created by the forum: members join on eoshadowforum.com with an access code, and an admin sets the date of their first forum. A member sees the forum (agendas, chat, photos) only from that date on. There is no public sign-up.
  Race Into the Shadow is a fitness contest between members, scored from each member's own WHOOP data. WHOOP data comes from the member's own WHOOP account (connected in Me > Biometrics, which opens WHOOP's sign-in) or from a WHOOP export file the member chooses or shares to the app. The app does not use HealthKit. Only the member sees their own biometrics; other members see the contest score.
  The kitty and the penalties are a record of what members agreed to contribute to the forum offline. No money is paid, collected or moved in the app.
  Ask AI answers from the forum's agendas and the member's own data, through a server-side AI model, and sees only what the member may see.
  The photo library is used to choose a profile photo and add photos to the forum gallery. The calendar is used only to add the next forum, after the member confirms.
  [Account deletion and chat reporting: add one line each here once built, for example "Me > Account and password > Delete my account deletes the account in the app" and "Press and hold a message to report it or block its sender".]
- **Contact:** Dave Hajdu, with a phone number and email Apple can reach during review.

## Unlisted distribution

The app is not in search, charts or recommendations; members install it from a direct link.
1. Fill in this listing and submit version 1.0 (build 3) for App Review with the unlisted line in the Notes for the reviewer.
2. Once it is submitted, request unlisted distribution at https://developer.apple.com/contact/request/unlisted-app/ with the app name and app ID 6840256415.
3. When Apple approves the request, App Store Connect shows the unlisted link. Share only that link with members.
4. Leave keywords filled in anyway; they do no harm and are ready if the app is ever listed.

## Screenshots

6.9-inch iPhone (1320 x 2868) required; 6.5-inch (1284 x 2778) optional. Take them from a build with `EXPO_PUBLIC_DEMO_PERSONA` set (fixtures with placeholder text, no real agenda content, nothing sent to Supabase), so no real member, score or agenda shows. Suggested set:
1. Home: the next forum and your race position.
2. Race Into the Shadow standings.
3. A rider's detail.
4. Biometrics: latest day and trends.
5. Chat with a thread.
6. Ask AI answering about an agenda.
7. The Home Screen widgets.

## Export compliance

Uses only standard encryption (HTTPS). `ITSAppUsesNonExemptEncryption` is false in `mobile/app.json`, so no question is asked per build.

## Open questions before pasting

- **No privacy policy page (blocker).** Apple requires a privacy policy URL. /privacy, /privacy-policy, /legal/privacy, /terms and /legal/terms on eoshadowforum.com all return 404, and the website has no such route in `app/`. It should cover the WHOOP data above, the AI assistant and how to delete an account.
- **No in-app account deletion (blocker, guideline 5.1.1(v)).** There is no delete-account control in the app (`mobile/src/app/(tabs)/me/index.tsx`, `mobile/src/app/(tabs)/me/profile.tsx`) or on the website, and no API route for it. Apple rejects apps that let you have an account but not delete it in the app. Build it (for example in Me > Account and password), then add the line to the reviewer notes.
- **No report or block in Chat (likely rejection, guideline 1.2).** Members post in one group chat (`mobile/src/components/ChatRoom.tsx`). A member can edit or delete their own message and an admin can delete any message, but there is no way to report a message or block a member. Apple asks for a report mechanism, a way to block abusive users and published contact details. Build report and block, or be ready to argue that a seven-member invite-only forum with admin removal is enough.
- **No support URL.** /support and /contact return 404, and the homepage is only the sign-in screen. Add a page with a contact email, or a contact line on the homepage.
- **Name mismatch.** App Store Connect says "The Shadow Forum"; the phone shows "Shadow Forum" (`name` in `mobile/app.json`, and the widget's `displayName`). Pick one. "Shadow Forum" is 12 characters and fits under the icon; "The Shadow Forum" may be truncated.
- **Copyright entity.** Nothing in the repo names it. The bundle ID prefix is `com.talentedge`; confirm whether it is Talent Edge, Edge8 or the forum.
- **Subtitle and category.** Both are proposals. Business follows the EO Vietnam app; Health & Fitness or Social Networking also fit.
- **Contests age-rating answer.** Race Into the Shadow carries agreed money penalties (up to 5M VND per place, settled outside the app). Answer "Contests" truthfully; it should not count as gambling because nothing is staked or paid in the app.
- **Financial info in App Privacy.** The kitty stores amounts owed and paid between members. Declaring "Other financial info" (App functionality) is the cautious answer; leaving it under user content is defensible. Dave's call.
- **AI declaration.** Ask AI is user-visible (the floating "Ask AI" button on every tab, `mobile/src/app/ask.tsx`) and runs on Anthropic's API server-side (`@anthropic-ai/sdk` in the website). Declare it in Apple's AI-generated content declaration.
- **Review account and privacy of the forum.** Any account with a first-forum date sees the real agendas, chat, photos and race from that date on. Pick a date that shows the reviewer enough without exposing private disclosures (for example the most recent forum), and tell the members first. Check whether the account then appears to members as a rider in the race and the penalties.
- **Share extension route (check before submitting).** Sharing a WHOOP export to the app runs `router.push("/contest/goal")` (`mobile/src/components/ShareIntake.tsx`), but the app has no `/contest/goal` route (the screen is `contest/goals.tsx`, and the upload card lives on `/me/whoop`). Not run on a device, but it looks like the share lands on a not-found screen. A reviewer who tries the share sheet would hit it.
- **Older native project.** `ios/` holds a separate SwiftUI client with bundle ID `org.eoshadowforum.app`. This listing is for the Expo app in `mobile/` (`com.talentedge.shadowforum`), which is what build 3 is from.
