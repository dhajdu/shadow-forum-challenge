-- Forum settings: one row that names the forum and sets its currency, dues,
-- time zone and site (Forum Manager plan, phase 1, 2026-11-28).
--
-- The app reads these instead of hard-coding one forum's name, currency and
-- time zone, so any EO or YPO forum can run its own copy. Active members read
-- the row; admins change it; nobody inserts or deletes it from a client.
--
-- coaches maps each rider (normalised full name: trimmed, lower case, single
-- spaces) to their coach's full name. It replaces the roster that was
-- hard-coded in lib/roster.ts and is seeded from the coaches already on goals.

create table if not exists public.forum_settings (
  id              boolean primary key default true check (id),
  name            text not null check (char_length(name) between 1 and 80),
  short_name      text not null check (char_length(short_name) between 1 and 40),
  organisation    text not null default 'EO' check (organisation in ('EO', 'YPO', 'other')),
  currency        text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  dues_per_forum  numeric not null default 0 check (dues_per_forum >= 0 and dues_per_forum < 1000000000000),
  time_zone       text not null default 'UTC',
  site_url        text not null check (site_url ~ '^https?://[^\s/]+$'),
  whoop_enabled   boolean not null default false,
  coaches         jsonb not null default '{}'::jsonb check (jsonb_typeof(coaches) = 'object'),
  updated_at      timestamptz not null default now(),
  updated_by      uuid references public.profiles (id) on delete set null
);

comment on table public.forum_settings is
  'One row: the forum''s name, organisation, currency, dues per forum, time zone, site and feature switches.';

-- A time zone must be one Postgres knows, so date maths never fails later.
create or replace function public.forum_settings_check()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.time_zone) then
    raise exception 'unknown time zone: %', new.time_zone;
  end if;
  new.updated_at := now();
  new.updated_by := coalesce(auth.uid(), new.updated_by);
  return new;
end;
$$;

drop trigger if exists forum_settings_check on public.forum_settings;
create trigger forum_settings_check before insert or update on public.forum_settings
  for each row execute function public.forum_settings_check();

alter table public.forum_settings enable row level security;

revoke all on table public.forum_settings from anon, authenticated;
grant select on table public.forum_settings to authenticated;
grant update (name, short_name, organisation, currency, dues_per_forum, time_zone, site_url, whoop_enabled, coaches)
  on table public.forum_settings to authenticated;

create policy "forum settings read" on public.forum_settings for select to authenticated
  using (public.is_active_member());
create policy "forum settings admin" on public.forum_settings for update to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());

-- Today in the forum's time zone. Column defaults use it instead of a fixed zone.
create or replace function public.forum_today()
returns date
language sql stable security definer
set search_path = public, pg_temp
as $$
  select (now() at time zone coalesce((select time_zone from public.forum_settings where id), 'UTC'))::date;
$$;
revoke all on function public.forum_today() from public, anon;
grant execute on function public.forum_today() to authenticated, service_role;

alter table public.kitty_entries alter column entry_on set default public.forum_today();
alter table public.forum_messages alter column sent_on set default public.forum_today();

-- The mobile app still reads dues from kitty_settings; keep it in step.
create or replace function public.forum_settings_sync_dues()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if new.dues_per_forum > 0 then
    update public.kitty_settings set dues_vnd = round(new.dues_per_forum)::bigint, updated_at = now()
     where id and dues_vnd is distinct from round(new.dues_per_forum)::bigint;
  end if;
  return new;
end;
$$;
revoke all on function public.forum_settings_sync_dues() from public, anon, authenticated;

drop trigger if exists forum_settings_sync_dues on public.forum_settings;
create trigger forum_settings_sync_dues after update of dues_per_forum on public.forum_settings
  for each row execute function public.forum_settings_sync_dues();

-- The Shadow Forum's own row, so nothing changes for it.
insert into public.forum_settings (id, name, short_name, organisation, currency, dues_per_forum, time_zone, site_url, whoop_enabled, coaches)
select
  true,
  'The Shadow Forum',
  'Shadow Forum',
  'EO',
  'VND',
  coalesce((select dues_vnd from public.kitty_settings where id), 2500000),
  'Asia/Ho_Chi_Minh',
  'https://eoshadowforum.com',
  true,
  coalesce((
    select jsonb_object_agg(lower(regexp_replace(trim(o.full_name), '\s+', ' ', 'g')), c.full_name)
      from (
        select distinct on (g.user_id) g.user_id, g.coach_id
          from public.goals g
         where g.coach_id is not null
         order by g.user_id, g.created_at desc
      ) g
      join public.profiles o on o.id = g.user_id
      join public.profiles c on c.id = g.coach_id
     where coalesce(trim(o.full_name), '') <> ''
  ), '{}'::jsonb)
on conflict (id) do nothing;
