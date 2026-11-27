-- Forum access rule.
--
-- Each member sees agendas, goals, coaching notes and contest seasons only from
-- their first forum (profiles.forum_joined_on) onward. Founding members see
-- everything. A member who has left (forum_left_on on or before today) sees
-- nothing. A profile with no join date sees nothing either.
--
-- The rule is written once, in member_can_see_date() / member_can_see_season(),
-- and every policy below goes through can_see_date() / can_see_season() for the
-- signed-in member. lib/access.ts mirrors the same logic for server jobs that
-- run with the service-role key (agents, email, push); the leak suite checks
-- that the two agree.

create extension if not exists vector with schema extensions;

-- ─────────────────────────────────────────────────────────
-- profiles: join and leave dates, admin and founding flags
alter table public.profiles add column if not exists forum_joined_on date;
alter table public.profiles add column if not exists forum_left_on   date;
alter table public.profiles add column if not exists is_admin        boolean not null default false;
alter table public.profiles add column if not exists is_founding     boolean not null default false;

comment on column public.profiles.forum_joined_on is
  'Date of the member''s first forum. Null means no access. Only admins change it (set_member_access).';
comment on column public.profiles.forum_left_on is
  'Set when a member leaves. From this date the member sees nothing.';

-- Members may update only their name and avatar. Access columns go through
-- set_member_access(), which checks is_admin.
revoke update on table public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;
revoke insert, delete on table public.profiles from anon, authenticated;

-- ─────────────────────────────────────────────────────────
-- seasons: the contest runs in seasons inside the permanent forum
create table if not exists public.seasons (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  starts_on  date not null,
  ends_on    date not null,
  metric     text,
  ladder     jsonb,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

insert into public.seasons (slug, name, starts_on, ends_on, metric, ladder)
values ('2026-q4', 'Q4 2026', date '2026-09-23', date '2026-12-22', 'whoop_score', '[0, 2, 3, 4, 5]'::jsonb)
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────
-- The rule, for any member (server-only) …
create or replace function public.member_is_active(uid uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = uid
      and (p.is_founding or p.forum_joined_on is not null)
      and (p.forum_left_on is null or p.forum_left_on > current_date)
  );
$$;

create or replace function public.member_can_see_date(uid uuid, d date)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select d is not null and exists (
    select 1 from public.profiles p
    where p.id = uid
      and (p.forum_left_on is null or p.forum_left_on > current_date)
      and (p.is_founding or (p.forum_joined_on is not null and d >= p.forum_joined_on))
  );
$$;

-- A season is visible only if it started on or after the member's first forum.
create or replace function public.member_can_see_season(uid uuid, s uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.seasons x
    where x.id = s and public.member_can_see_date(uid, x.starts_on)
  );
$$;

revoke all on function public.member_is_active(uuid) from public, anon, authenticated;
revoke all on function public.member_can_see_date(uuid, date) from public, anon, authenticated;
revoke all on function public.member_can_see_season(uuid, uuid) from public, anon, authenticated;
grant execute on function public.member_is_active(uuid) to service_role;
grant execute on function public.member_can_see_date(uuid, date) to service_role;
grant execute on function public.member_can_see_season(uuid, uuid) to service_role;

-- … and for the signed-in member. The service role (server jobs) passes, as it
-- already bypasses RLS; those jobs scope themselves through lib/access.ts.
create or replace function public.can_see_date(d date)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth.role() = 'service_role', false)
      or public.member_can_see_date(auth.uid(), d);
$$;

create or replace function public.can_see_season(s uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth.role() = 'service_role', false)
      or public.member_can_see_season(auth.uid(), s);
$$;

create or replace function public.is_active_member()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$ select public.member_is_active(auth.uid()); $$;

create or replace function public.is_founding_member()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.member_is_active(auth.uid())
     and exists (select 1 from public.profiles where id = auth.uid() and is_founding);
$$;

create or replace function public.is_forum_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.member_is_active(auth.uid())
     and exists (select 1 from public.profiles where id = auth.uid() and is_admin);
$$;

-- The season a day belongs to: the latest season that had started by then.
-- Days after a season ends stay in it until the next one starts.
create or replace function public.season_of(d date)
returns uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select id from public.seasons where starts_on <= d order by starts_on desc limit 1;
$$;

revoke all on function public.can_see_date(date) from public, anon;
revoke all on function public.can_see_season(uuid) from public, anon;
revoke all on function public.is_active_member() from public, anon;
revoke all on function public.is_founding_member() from public, anon;
revoke all on function public.is_forum_admin() from public, anon;
revoke all on function public.season_of(date) from public, anon;
grant execute on function public.can_see_date(date) to authenticated, service_role;
grant execute on function public.can_see_season(uuid) to authenticated, service_role;
grant execute on function public.is_active_member() to authenticated, service_role;
grant execute on function public.is_founding_member() to authenticated, service_role;
grant execute on function public.is_forum_admin() to authenticated, service_role;
grant execute on function public.season_of(date) to authenticated, service_role;

-- Admins set a member's access. Members cannot touch these columns directly.
create or replace function public.set_member_access(
  member uuid,
  joined_on date,
  left_on date,
  founding boolean,
  admin boolean
)
returns void
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not public.is_forum_admin() then
    raise exception 'only admins can change member access' using errcode = '42501';
  end if;
  update public.profiles
     set forum_joined_on = joined_on,
         forum_left_on   = left_on,
         is_founding     = founding,
         is_admin        = admin
   where id = member;
  if not found then
    raise exception 'no such member';
  end if;
end;
$$;
revoke all on function public.set_member_access(uuid, date, date, boolean, boolean) from public, anon;
grant execute on function public.set_member_access(uuid, date, date, boolean, boolean) to authenticated;

-- ─────────────────────────────────────────────────────────
-- Existing members. Founding: the four since the 19 Jan 2026 kickoff. Nam Trung
-- (signed up as "Tran Trung") from the 28 Jul 2026 forum. Every other profile
-- keeps a null join date, which means no access until an admin sets one.
-- Confirmed by Dave on 2026-11-27 (founding four, Dave as only admin, Tran Trung = Nam Trung).
update public.profiles
   set is_founding = true, forum_joined_on = date '2026-01-19'
 where lower(regexp_replace(trim(full_name), '\s+', ' ', 'g'))
       in ('dave hajdu', 'dru nguyen', 'vinh nguyen', 'anh le');
update public.profiles
   set forum_joined_on = date '2026-07-28'
 where lower(regexp_replace(trim(full_name), '\s+', ' ', 'g')) = 'tran trung';
update public.profiles
   set is_admin = true
 where lower(regexp_replace(trim(full_name), '\s+', ' ', 'g')) = 'dave hajdu';

-- ─────────────────────────────────────────────────────────
-- Season-bound contest data
alter table public.goals     add column if not exists season_id uuid references public.seasons (id);
alter table public.penalties add column if not exists season_id uuid references public.seasons (id);
update public.goals     set season_id = (select id from public.seasons where slug = '2026-q4') where season_id is null;
update public.penalties set season_id = (select id from public.seasons where slug = '2026-q4') where season_id is null;
create index if not exists goals_season_idx on public.goals (season_id);
create index if not exists penalties_season_idx on public.penalties (season_id);

-- New goals and penalties land in the season running today unless told otherwise.
create or replace function public.default_season_today()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.season_id is null then
    new.season_id := public.season_of(current_date);
  end if;
  return new;
end;
$$;

drop trigger if exists goals_default_season on public.goals;
create trigger goals_default_season before insert on public.goals
  for each row execute function public.default_season_today();
drop trigger if exists penalties_default_season on public.penalties;
create trigger penalties_default_season before insert on public.penalties
  for each row execute function public.default_season_today();

-- ─────────────────────────────────────────────────────────
-- Forum: meetings, agenda text, search chunks, library
create table if not exists public.meetings (
  id               uuid primary key default gen_random_uuid(),
  held_on          date not null,
  starts_at        timestamptz,
  place            text,
  title            text,
  kind             text not null default 'forum' check (kind in ('forum', 'retreat', 'kickoff')),
  status           text not null default 'planned' check (status in ('planned', 'held')),
  lark_node_token  text unique,
  eovn_meeting_id  text unique,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists meetings_held_on_idx on public.meetings (held_on);

create table if not exists public.meeting_docs (
  id                uuid primary key default gen_random_uuid(),
  meeting_id        uuid not null references public.meetings (id) on delete cascade,
  title             text not null default '',
  body_md           text not null default '',
  source_updated_at timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists meeting_docs_meeting_idx on public.meeting_docs (meeting_id);

-- Embedding size 1024 (e.g. voyage-3). held_on is copied from the meeting so the
-- search index carries its own date and is filtered without a join.
create table if not exists public.meeting_chunks (
  id          uuid primary key default gen_random_uuid(),
  meeting_id  uuid not null references public.meetings (id) on delete cascade,
  held_on     date not null,
  content     text not null,
  embedding   extensions.vector(1024),
  created_at  timestamptz not null default now()
);
create index if not exists meeting_chunks_meeting_idx on public.meeting_chunks (meeting_id);
create index if not exists meeting_chunks_held_on_idx on public.meeting_chunks (held_on);

create or replace function public.meeting_chunk_held_on()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  select m.held_on into new.held_on from public.meetings m where m.id = new.meeting_id;
  return new;
end;
$$;
drop trigger if exists meeting_chunks_held_on on public.meeting_chunks;
create trigger meeting_chunks_held_on before insert or update on public.meeting_chunks
  for each row execute function public.meeting_chunk_held_on();

create or replace function public.meeting_held_on_cascade()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  update public.meeting_chunks set held_on = new.held_on where meeting_id = new.id;
  return new;
end;
$$;
drop trigger if exists meetings_held_on_cascade on public.meetings;
create trigger meetings_held_on_cascade after update of held_on on public.meetings
  for each row when (old.held_on is distinct from new.held_on)
  execute function public.meeting_held_on_cascade();

-- Undated pages. audience null means no one sees it.
create table if not exists public.library_docs (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  title       text not null,
  body_md     text,
  file_path   text,
  audience    text check (audience in ('all', 'founding')),
  sort        int not null default 0,
  updated_at  timestamptz not null default now()
);

-- Expo push devices (global mobile standard). Android allowed, not built yet.
create table if not exists public.push_devices (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  platform      text not null check (platform in ('ios', 'android')),
  expo_token    text not null unique,
  app_version   text,
  last_seen_at  timestamptz not null default now(),
  revoked_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists push_devices_user_idx on public.push_devices (user_id);

-- ─────────────────────────────────────────────────────────
-- Assistant retrieval. Security invoker: it runs as the member, so the
-- meeting_chunks policy filters before anything reaches the model. The explicit
-- can_see_date() is a second lock, not the first.
create or replace function public.match_meeting_chunks(
  query_embedding extensions.vector(1024),
  match_count int default 8,
  only_meeting uuid default null
)
returns table (id uuid, meeting_id uuid, held_on date, content text, similarity float8)
language sql stable security invoker
set search_path = public, extensions, pg_temp
as $$
  select c.id, c.meeting_id, c.held_on, c.content,
         1 - (c.embedding <=> query_embedding) as similarity
  from public.meeting_chunks c
  where c.embedding is not null
    and public.can_see_date(c.held_on)
    and (only_meeting is null or c.meeting_id = only_meeting)
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 50);
$$;
revoke all on function public.match_meeting_chunks(extensions.vector, int, uuid) from public, anon;
grant execute on function public.match_meeting_chunks(extensions.vector, int, uuid) to authenticated, service_role;

-- ─────────────────────────────────────────────────────────
-- RLS: new tables
alter table public.seasons        enable row level security;
alter table public.meetings       enable row level security;
alter table public.meeting_docs   enable row level security;
alter table public.meeting_chunks enable row level security;
alter table public.library_docs   enable row level security;
alter table public.push_devices   enable row level security;

create policy "seasons visible" on public.seasons for select to authenticated
  using (public.can_see_season(id));
create policy "seasons admin insert" on public.seasons for insert to authenticated with check (public.is_forum_admin());
create policy "seasons admin update" on public.seasons for update to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());

create policy "meetings from join date" on public.meetings for select to authenticated
  using (public.can_see_date(held_on));
create policy "meetings admin insert" on public.meetings for insert to authenticated with check (public.is_forum_admin());
create policy "meetings admin update" on public.meetings for update to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());
create policy "meetings admin delete" on public.meetings for delete to authenticated using (public.is_forum_admin());

create policy "docs from join date" on public.meeting_docs for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_id and public.can_see_date(m.held_on)));
create policy "docs admin insert" on public.meeting_docs for insert to authenticated with check (public.is_forum_admin());
create policy "docs admin update" on public.meeting_docs for update to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());
create policy "docs admin delete" on public.meeting_docs for delete to authenticated using (public.is_forum_admin());

create policy "chunks from join date" on public.meeting_chunks for select to authenticated
  using (public.can_see_date(held_on));
-- chunk writes: service role only (the import/embedding job)

create policy "library by audience" on public.library_docs for select to authenticated
  using (
    public.is_active_member()
    and (audience = 'all' or (audience = 'founding' and public.is_founding_member()))
  );
create policy "library admin insert" on public.library_docs for insert to authenticated with check (public.is_forum_admin());
create policy "library admin update" on public.library_docs for update to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());
create policy "library admin delete" on public.library_docs for delete to authenticated using (public.is_forum_admin());

create policy "push devices own read" on public.push_devices for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member());
create policy "push devices own insert" on public.push_devices for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_member());
create policy "push devices own update" on public.push_devices for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member())
  with check (user_id = (select auth.uid()));
create policy "push devices own delete" on public.push_devices for delete to authenticated
  using (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────
-- RLS: re-point the 0001–0011 policies at the rule
drop policy if exists "profiles read"       on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
-- your own row always (so the app can say "no access"); others only while active
create policy "profiles read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.is_active_member());
create policy "profiles update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy if exists "goals read"       on public.goals;
drop policy if exists "goals insert own" on public.goals;
drop policy if exists "goals update own" on public.goals;
create policy "goals in visible seasons" on public.goals for select to authenticated
  using (public.is_active_member() and public.can_see_season(season_id));
create policy "goals insert own" on public.goals for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_member() and public.can_see_season(season_id));
create policy "goals update own" on public.goals for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member() and public.can_see_season(season_id))
  with check (user_id = (select auth.uid()) and public.can_see_season(season_id));

drop policy if exists "progress read own or coach" on public.goal_progress;
drop policy if exists "progress insert own"        on public.goal_progress;
create policy "progress read own or coach" on public.goal_progress for select to authenticated
  using (
    public.is_active_member()
    and exists (
      select 1 from public.goals g
      where g.id = goal_id
        and public.can_see_season(g.season_id)
        and (g.user_id = (select auth.uid()) or g.coach_id = (select auth.uid()) or public.is_forum_admin())
    )
  );
create policy "progress insert own" on public.goal_progress for insert to authenticated
  with check (
    public.is_active_member()
    and exists (
      select 1 from public.goals g
      where g.id = goal_id and g.user_id = (select auth.uid()) and public.can_see_season(g.season_id)
    )
  );

drop policy if exists "whoop read"      on public.whoop_days;
drop policy if exists "whoop write own" on public.whoop_days;
create policy "whoop read" on public.whoop_days for select to authenticated
  using (
    public.is_active_member()
    and (user_id = (select auth.uid()) or public.can_see_season(public.season_of(day)))
  );
create policy "whoop insert own" on public.whoop_days for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_member());
create policy "whoop update own" on public.whoop_days for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member())
  with check (user_id = (select auth.uid()));
create policy "whoop delete own" on public.whoop_days for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member());

drop policy if exists "uploads own" on public.uploads;
create policy "uploads own" on public.uploads for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member())
  with check (user_id = (select auth.uid()) and public.is_active_member());

drop policy if exists "notes read own or coach" on public.coaching_notes;
drop policy if exists "notes insert as author"  on public.coaching_notes;
create policy "notes read own or coach" on public.coaching_notes for select to authenticated
  using (
    public.is_active_member()
    and public.can_see_date(created_at::date)
    and exists (
      select 1 from public.goals g
      where g.id = goal_id
        and public.can_see_season(g.season_id)
        and (g.user_id = (select auth.uid()) or g.coach_id = (select auth.uid()) or public.is_forum_admin())
    )
  );
create policy "notes insert as author" on public.coaching_notes for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_active_member()
    and exists (
      select 1 from public.goals g
      where g.id = goal_id
        and public.can_see_season(g.season_id)
        and (g.user_id = (select auth.uid()) or g.coach_id = (select auth.uid()))
    )
  );

drop policy if exists "penalties read" on public.penalties;
create policy "penalties in visible seasons" on public.penalties for select to authenticated
  using (public.is_active_member() and public.can_see_season(season_id));

drop policy if exists "snapshots read" on public.standings_snapshots;
create policy "snapshots in visible seasons" on public.standings_snapshots for select to authenticated
  using (public.is_active_member() and public.can_see_season(public.season_of(day)));

drop policy if exists "personal read own"  on public.personal_goals;
drop policy if exists "personal write own" on public.personal_goals;
create policy "personal own" on public.personal_goals for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member())
  with check (user_id = (select auth.uid()) and public.is_active_member());

drop policy if exists "journal own" on public.whoop_journal;
create policy "journal own" on public.whoop_journal for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member())
  with check (user_id = (select auth.uid()) and public.is_active_member());

drop policy if exists "whoop connection read own" on public.whoop_connections;
create policy "whoop connection read own" on public.whoop_connections for select to authenticated
  using ((select auth.uid()) = user_id and public.is_active_member());

-- Race standings: only the season's riders (joined by its first day), and only
-- for members who can see the season. Same columns as 0010.
create or replace view public.race_standings
with (security_invoker = true) as
with season as (
  select id, starts_on from public.seasons where slug = '2026-q4'
),
riders as (
  select p.id, p.full_name
  from public.profiles p, season s
  where public.can_see_season(s.id)
    and (p.is_founding or (p.forum_joined_on is not null and p.forum_joined_on <= s.starts_on))
),
scored as (
  select user_id, day, score
  from public.whoop_days
  where score is not null
),
agg as (
  select
    p.id as user_id,
    coalesce(nullif(p.full_name, ''), 'Rider') as full_name,
    avg(c.score) filter (where c.day >= date '2026-09-23') as contest_avg,
    count(c.day) filter (where c.day >= date '2026-09-23') as contest_days,
    max(c.day) filter (where c.day >= date '2026-09-23') as contest_last,
    avg(c.score) as all_avg,
    count(c.day) as all_days,
    max(c.day) as last_day
  from riders p
  left join scored c on c.user_id = p.id
  group by p.id, p.full_name
)
select
  a.user_id,
  a.full_name,
  round(coalesce(a.contest_avg, 0), 1)::float8 as contest_avg,
  a.contest_days::int as contest_days,
  case
    when a.contest_last is null then 0
    else (a.contest_last - date '2026-09-23' + 1) - a.contest_days
  end::int as contest_missed,
  round(coalesce(a.all_avg, 0), 1)::float8 as all_avg,
  a.all_days::int as all_days,
  a.last_day,
  (select max(w.day) from public.whoop_days w where w.user_id = a.user_id) as last_data_day
from agg a;

-- ─────────────────────────────────────────────────────────
-- Storage: agenda attachments under meeting-files/<meeting_id>/...
insert into storage.buckets (id, name, public)
values ('meeting-files', 'meeting-files', false)
on conflict (id) do nothing;

create or replace function public.can_see_meeting_object(object_name text)
returns boolean
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  first_folder text := split_part(object_name, '/', 1);
  held date;
begin
  if first_folder !~ '^[0-9a-fA-F-]{36}$' then
    return false;
  end if;
  select m.held_on into held from public.meetings m where m.id = first_folder::uuid;
  return held is not null and public.can_see_date(held);
end;
$$;
revoke all on function public.can_see_meeting_object(text) from public, anon;
grant execute on function public.can_see_meeting_object(text) to authenticated, service_role;

create policy "meeting files from join date" on storage.objects for select to authenticated
  using (bucket_id = 'meeting-files' and public.can_see_meeting_object(name));
create policy "meeting files admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'meeting-files' and public.is_forum_admin());
create policy "meeting files admin update" on storage.objects for update to authenticated
  using (bucket_id = 'meeting-files' and public.is_forum_admin());
create policy "meeting files admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'meeting-files' and public.is_forum_admin());

-- The WHOOP upload folder: owner only, and only while a member.
drop policy if exists "whoop upload own folder" on storage.objects;
drop policy if exists "whoop read own folder"   on storage.objects;
drop policy if exists "whoop delete own folder" on storage.objects;
create policy "whoop upload own folder" on storage.objects for insert to authenticated
  with check (bucket_id = 'whoop' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_member());
create policy "whoop read own folder" on storage.objects for select to authenticated
  using (bucket_id = 'whoop' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_member());
create policy "whoop delete own folder" on storage.objects for delete to authenticated
  using (bucket_id = 'whoop' and (storage.foldername(name))[1] = auth.uid()::text and public.is_active_member());
