# The Shadow Forum — iOS

Native SwiftUI client (iOS 17+, Swift 6) for the same Supabase backend and web API as
https://eoshadowforum.com. No business logic is duplicated: scores, standings and averages come
from the database (`race_standings`, `whoop_days`), and ingest, sign-up, goal updates and the
assistant go through the web API (`/api/ingest`, `/api/signup`, `/api/goal`, `/api/assistant`)
with the rider's Supabase access token.

## Setup

```sh
brew install xcodegen
cp Config/Secrets.example.xcconfig Config/Secrets.xcconfig   # add the Supabase URL + anon key
xcodegen generate
open ShadowForum.xcodeproj
```

- `Config/Secrets.xcconfig` is gitignored. Only the **public anon key** goes there — never the service-role key.
- `SF_API_BASE_URL` (in `Config/App.xcconfig`) points at production; override it in Secrets to use `next dev`.
- Device builds: set your Team in Xcode, and register the App Group `group.org.eoshadowforum.app`
  (used by the share extension and widgets).
- Needs the web API from PR #54 deployed (bearer auth + `/api/ingest`).

## Debug helpers

Debug builds only:

- `-demo` launch argument — offline fixture data (fictional riders), no network.
- `-screen race|zone|rider|upload|chat|rules|report|signin|onboarding` — open straight to a screen.

```sh
xcrun simctl launch booted org.eoshadowforum.app -demo -screen zone
```

## Layout

| Path | What |
| --- | --- |
| `ShadowForum/Core/LiveBackend.swift` | Supabase reads (RLS as the rider) + web API calls with `Authorization: Bearer` |
| `ShadowForum/Core/Race.swift` | Contest constants, ranking and labels (mirrors `lib/contest.ts`, `lib/standings.ts`) |
| `ShadowForum/Core/Stats.swift` | My Zone / Rider presentation helpers (port of `app/me/stats.ts`) |
| `ShadowForum/Features/*` | Race, Rider detail, My Zone, Upload, Chat, Rules, Report, sign-in/onboarding |
| `ShareExtension/` | Share a WHOOP `.zip` from any app → saved to the App Group inbox → the app uploads it on open |
| `Widgets/` | "My place" and "Race top 3" widgets, fed by a snapshot the app writes to the App Group |

The share extension never sees credentials: it only drops the file in the shared container.
The app also accepts a zip via "Open in…" (document type).

## Not built yet

- **Push (APNs)** — needs an APNs key, a `device_tokens` table, and the Monday analyst / weekly whip
  crons to send. The crons already exist on the web side; they'd call APNs instead of (or as well as) email.
- **WHOOP API (OAuth)** — would replace zip uploads with a server-side sync; needs a WHOOP developer app
  and a token table. Manual zip upload stays the source of truth for now.
