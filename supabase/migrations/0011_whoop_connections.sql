-- Per-member WHOOP OAuth connection.
--
-- Tokens are ciphertext, not plaintext. The app encrypts them with AES-256-GCM
-- before insert (see lib/whoop/crypto.ts). The key is WHOOP_TOKEN_ENCRYPTION_KEY
-- and never lives in the database, so a database read alone cannot use a token.
--
-- Writes are service-role only (that role bypasses RLS). Authenticated members
-- can read their own non-secret columns, via the view below or a column grant.
-- There is no insert/update/delete policy for the browser.

create table if not exists public.whoop_connections (
  user_id            uuid primary key references public.profiles (id) on delete cascade,
  whoop_user_id      bigint,
  status             text not null default 'connected'
                       check (status in ('connected', 'disconnected', 'revoked')),
  access_token_enc   text,
  refresh_token_enc  text,
  token_expires_at   timestamptz,
  scopes             text,
  connected_at       timestamptz,
  last_sync_at       timestamptz,
  last_error         text,
  updated_at         timestamptz not null default now()
);

comment on table public.whoop_connections is
  'WHOOP OAuth link per member. access_token_enc and refresh_token_enc are AES-256-GCM ciphertext; the key is an environment variable, not a column.';
comment on column public.whoop_connections.access_token_enc is
  'AES-256-GCM ciphertext of the WHOOP access token. Browser roles cannot select it.';
comment on column public.whoop_connections.refresh_token_enc is
  'AES-256-GCM ciphertext of the WHOOP refresh token. WHOOP rotates this on every refresh; always overwrite it.';

create index if not exists whoop_connections_whoop_user_idx
  on public.whoop_connections (whoop_user_id);

-- One connected forum member per WHOOP account. Revoked rows do not hold the slot.
create unique index if not exists whoop_connections_one_live_whoop_user
  on public.whoop_connections (whoop_user_id)
  where status = 'connected' and whoop_user_id is not null;

alter table public.whoop_connections enable row level security;
alter table public.whoop_connections force row level security;

revoke all on table public.whoop_connections from public, anon, authenticated;

grant select (
  user_id,
  whoop_user_id,
  status,
  scopes,
  connected_at,
  last_sync_at,
  last_error,
  updated_at
) on public.whoop_connections to authenticated;

drop policy if exists "whoop connection read own" on public.whoop_connections;
create policy "whoop connection read own"
  on public.whoop_connections
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

-- Safe projection. security_invoker so the row policy and column grants above apply.
create or replace view public.whoop_connection_status
with (security_invoker = true) as
select
  user_id,
  whoop_user_id,
  status,
  scopes,
  connected_at,
  last_sync_at,
  last_error,
  updated_at
from public.whoop_connections;

comment on view public.whoop_connection_status is
  'Member-visible WHOOP link status. Tokens are not in this view.';

revoke all on public.whoop_connection_status from public, anon;
grant select on public.whoop_connection_status to authenticated;
