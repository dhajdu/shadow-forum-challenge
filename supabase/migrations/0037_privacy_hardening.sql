-- Privacy hardening from the security review (M1, M4, M5).
--
-- profiles: members no longer read anyone's email or last_seen_at through the
-- API. The app shows a member their own email from their session, and admins
-- get the member list from a server route after is_forum_admin().
--
-- constitution_signatures: members no longer read signers' IP address or user
-- agent. They stay as signature evidence for the service role.
--
-- avatars: the bucket stays public for display (public URLs need no policy),
-- but nobody can list it any more: each member reads only their own folder
-- (needed to replace a photo). Images only, at most 15 MB.
--
-- signup_attempts: the access-code sign-up (lib/signup.ts) counts attempts per
-- IP address and refuses after too many. Service role only.

-- ─────────────────────────────────────────────────────────
revoke select on table public.profiles from anon, authenticated;
grant select (id, full_name, avatar_url, is_coach, created_at, forum_joined_on, forum_left_on, is_admin, is_founding)
  on table public.profiles to authenticated;

revoke select on table public.constitution_signatures from anon, authenticated;
grant select (id, version_id, user_id, typed_name, consent, sha256_shown, signed_at)
  on table public.constitution_signatures to authenticated;

-- ─────────────────────────────────────────────────────────
drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars read own" on storage.objects;
create policy "avatars read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

update storage.buckets
   set file_size_limit = 15728640,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
 where id = 'avatars';

-- ─────────────────────────────────────────────────────────
create table if not exists public.signup_attempts (
  id  bigint generated always as identity primary key,
  ip  text not null,
  ok  boolean not null,
  at  timestamptz not null default now()
);
create index if not exists signup_attempts_at_idx on public.signup_attempts (at);
create index if not exists signup_attempts_ip_at_idx on public.signup_attempts (ip, at);

comment on table public.signup_attempts is
  'Access-code sign-up attempts, for the rate limit in lib/signup.ts. Service role only; rows older than a day are deleted.';

alter table public.signup_attempts enable row level security;
alter table public.signup_attempts force row level security;
revoke all on table public.signup_attempts from anon, authenticated;
