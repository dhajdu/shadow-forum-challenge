-- E-signature for the Constitution (Dave, 2026-11-28): "each member has to
-- esign the constitution. If there are amendments, we have to resign again."
--
-- Modelled on Edge8's agreements: a typed-name signature with a consent box,
-- the document pinned by its sha256, and the signer's IP and browser kept as
-- evidence. Each amendment is a new version, and a signature counts only for
-- the version it was made on, so publishing a version asks everyone to sign
-- again. Nothing is updated or deleted.

create table if not exists public.constitution_versions (
  id            uuid primary key default gen_random_uuid(),
  version       integer not null unique check (version > 0),
  body_md       text not null check (char_length(body_md) between 1 and 100000),
  sha256        text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  change_note   text check (change_note is null or char_length(change_note) <= 2000),  -- what the amendment changed
  published_by  uuid references public.profiles (id) on delete set null,
  published_at  timestamptz not null default now()
);

create table if not exists public.constitution_signatures (
  id            uuid primary key default gen_random_uuid(),
  version_id    uuid not null references public.constitution_versions (id) on delete restrict,
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  typed_name    text not null check (char_length(typed_name) between 2 and 120),
  consent       text not null check (char_length(consent) between 10 and 500),  -- the exact words they agreed to
  sha256_shown  text not null check (sha256_shown ~ '^[0-9a-f]{64}$'),
  ip            text check (ip is null or char_length(ip) <= 100),
  user_agent    text check (user_agent is null or char_length(user_agent) <= 500),
  signed_at     timestamptz not null default now(),
  unique (version_id, user_id)
);
create index if not exists constitution_signatures_user_idx on public.constitution_signatures (user_id);

alter table public.constitution_versions enable row level security;
alter table public.constitution_signatures enable row level security;

revoke insert, update, delete on table public.constitution_versions from anon, authenticated;
revoke insert, update, delete on table public.constitution_signatures from anon, authenticated;
grant insert (version, body_md, sha256, change_note) on table public.constitution_versions to authenticated;
grant insert (version_id, typed_name, consent, sha256_shown, ip, user_agent) on table public.constitution_signatures to authenticated;

-- Every active member reads the Constitution, every version of it, and who has signed.
create policy "constitution read" on public.constitution_versions for select to authenticated
  using (public.is_active_member());
create policy "constitution signatures read" on public.constitution_signatures for select to authenticated
  using (public.is_active_member());

-- Admins publish a new version: the next number, stamped with who published it.
create or replace function public.constitution_version_stamp()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.published_by := auth.uid();
  new.published_at := now();
  return new;
end;
$$;
drop trigger if exists constitution_version_stamp on public.constitution_versions;
create trigger constitution_version_stamp before insert on public.constitution_versions
  for each row when (auth.uid() is not null) execute function public.constitution_version_stamp();

create policy "constitution admin publish" on public.constitution_versions for insert to authenticated
  with check (
    public.is_forum_admin()
    and version = coalesce((select max(v.version) from public.constitution_versions v), 0) + 1
  );

-- A member signs for themselves, only the newest version, only the text they were shown.
create policy "constitution sign as yourself" on public.constitution_signatures for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_active_member()
    and exists (
      select 1 from public.constitution_versions v
      where v.id = version_id
        and v.sha256 = sha256_shown
        and v.version = (select max(x.version) from public.constitution_versions x)
    )
  );
