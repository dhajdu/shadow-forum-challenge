# The Shadow Forum

## Map

- **Design system:** [`docs/design-system.md`](docs/design-system.md). Read it before writing any UI. Browsable reference: https://claude.ai/artifact/K8kPJELdj1AoFzUXi8M2kX
- **Tokens:** `app/globals.css` `:root` (web), `ios/ShadowForum/Theme/Theme.swift` (iOS).
- **Component reference:** the Components table in `docs/design-system.md`; shared React components in `components/`.
- **Ship:** branch per change, PR to `main`, merge. Vercel deploys `main` to production. No CLI deploys.

## Stack

Next.js 15 (App Router), React 19, TypeScript, Supabase (Auth, Postgres with RLS, Storage), Vercel. Native iOS app in `ios/` (SwiftUI, XcodeGen `project.yml`).

## Conventions

- Use tokens for every color, radius and font size. No new hex or px literals in CSS; add a token instead.
- Page layout goes in a CSS module next to the page; shared patterns go in `app/globals.css`.
- Checks: `npm run typecheck`, `npm run lint`. `npm run build` needs Supabase keys in `.env.local`.
- Migrations live in `supabase/migrations/`, numbered sequentially.
- New env var: add to `.env.example`, `.env.local` and Vercel in the same PR.
