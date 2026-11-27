-- WHOOP OAuth state for the iPhone app, which starts the flow with a Bearer
-- token and so has no browser cookie. WHOOP requires an 8-character state, so it
-- cannot carry a signature; the state is bound to the member here instead.
-- Service role only. Single use: the callback deletes the row it consumes.
create table if not exists public.whoop_oauth_states (
  state       text primary key check (state ~ '^[A-Za-z0-9]{8}$'),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  expires_at  timestamptz not null default now() + interval '10 minutes',
  created_at  timestamptz not null default now()
);
alter table public.whoop_oauth_states enable row level security;
alter table public.whoop_oauth_states force row level security;
revoke all on table public.whoop_oauth_states from public, anon, authenticated;
