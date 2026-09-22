# The Shadow Forum

A private Q4 2026 accountability app for five members: a WHOOP-score contest — **Race Into the Shadow** — plus business-goal accountability with monthly coaching.

## Stack
- **Next.js 15** (App Router), React 19, TypeScript
- **Supabase** — Auth, Postgres (RLS), Storage, Edge Functions
- **Resend** for email · **Vercel** for hosting (preview per PR)

## Getting started
```bash
npm install
cp .env.example .env.local   # fill in Supabase + integration keys
npm run dev                  # http://localhost:3000
```

## Scripts
- `npm run dev` — local dev server
- `npm run build` — production build
- `npm run lint` — ESLint
- `npm run typecheck` — `tsc --noEmit`

## Design & plan
See [`docs/`](docs/):
- `plan.html` — the accountability plan (contest, goals, agents, member area)
- `prototype.html` — lo-fi clickable prototype
- `design-home.html` — hi-fi home (Race Into the Shadow)
- `devplan.html` — build plan (PRs & milestones)

## Access & agents
- **Sign-up is gated** by a shared access code — set `SIGNUP_ACCESS_CODE` (verified server-side).
- **Agents** run as Vercel Cron; `/api/cron/*` is authorized by `CRON_SECRET`.
- Both must be set in Vercel for production to work.

## Ways of working
- One branch per PR (`feat/*`); small, reviewable diffs.
- Merge to `main` → Vercel deploys production. No CLI deploys.
- New env var → add to `.env.local` **and** Vercel in the same PR.
- Never commit `.env*` or secrets. RLS on by default.
