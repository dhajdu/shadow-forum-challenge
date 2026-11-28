-- Forum planning (Dave, 2026-11-28).
--
-- Every forum opens with MERPS and a conversation starter series, and has a host
-- (who picks the place), a theme, 5% updates, one planned
-- presentation (presenter + coach, in rotation), a goals update, housekeeping
-- at the end and an optional after-forum activity. Some add an extra activity or
-- a guest speaker. The run sheet (all of that, with times) is meeting_agenda_items.
-- Away forums (e.g. Nha Trang) and the yearly retreat (e.g. GLC Kyoto) have
-- assigned planners; a retreat is one agenda over several days, travel included. Each year has roles: moderator, moderator elect, treasurer, retreat
-- planner.
--
-- Everything tied to a meeting follows the meeting's date rule (can_see_date),
-- so a member never learns who presented or coached before they joined.

alter table public.meetings drop constraint if exists meetings_kind_check;
alter table public.meetings add constraint meetings_kind_check
  check (kind in ('forum', 'away', 'retreat', 'kickoff'));

alter table public.meetings add column if not exists ends_on        date;
alter table public.meetings add column if not exists address        text;
alter table public.meetings add column if not exists host_id        uuid references public.profiles (id) on delete set null;
alter table public.meetings add column if not exists theme          text;
alter table public.meetings add column if not exists after_activity text;
alter table public.meetings add column if not exists conversation_starters text[];

alter table public.meetings drop constraint if exists meetings_ends_on_check;
alter table public.meetings add constraint meetings_ends_on_check
  check (ends_on is null or ends_on >= held_on);

-- Planned presentations: one per forum, two at the retreat. 'live' is the
-- optional live-coached one, recorded after the fact if it happens.
create table if not exists public.meeting_presentations (
  id           uuid primary key default gen_random_uuid(),
  meeting_id   uuid not null references public.meetings (id) on delete cascade,
  presenter_id uuid not null references public.profiles (id) on delete cascade,
  coach_id     uuid references public.profiles (id) on delete set null,
  kind         text not null default 'planned' check (kind in ('planned', 'live')),
  created_at   timestamptz not null default now(),
  unique (meeting_id, presenter_id),
  check (coach_id is null or coach_id <> presenter_id)
);
create index if not exists meeting_presentations_meeting_idx on public.meeting_presentations (meeting_id);

-- The run sheet: one row per line, in order. day is for multi-day agendas
-- (null = the meeting's date). Housekeeping topics, extras and guests are lines here.
create table if not exists public.meeting_agenda_items (
  id         uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  position   int  not null,
  day        date,
  starts_at  time,
  minutes    int  check (minutes is null or minutes between 0 and 1440),
  kind       text not null check (kind in (
    'arrival', 'welcome', 'starters', 'merps', 'updates', 'goals', 'presentation', 'lifeline',
    'activity', 'guest', 'break', 'housekeeping', 'close',
    'travel', 'hotel', 'meal', 'sight', 'free', 'other')),
  title      text not null check (length(title) between 1 and 300),
  owner_id   uuid references public.profiles (id) on delete set null,
  details    text check (details is null or length(details) <= 4000),
  created_at timestamptz not null default now(),
  unique (meeting_id, position)
);

-- Planners of an away forum or retreat.
create table if not exists public.meeting_planners (
  meeting_id uuid not null references public.meetings (id) on delete cascade,
  member_id  uuid not null references public.profiles (id) on delete cascade,
  primary key (meeting_id, member_id)
);

-- Yearly roles. A role with no row is undecided.
create table if not exists public.forum_roles (
  id         uuid primary key default gen_random_uuid(),
  year       int  not null check (year between 2025 and 2100),
  role       text not null check (role in ('moderator', 'moderator_elect', 'treasurer', 'retreat_planner')),
  member_id  uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (year, role, member_id)
);

alter table public.meeting_presentations enable row level security;
alter table public.meeting_planners      enable row level security;
alter table public.forum_roles           enable row level security;
alter table public.meeting_agenda_items  enable row level security;

create policy "agenda items from join date" on public.meeting_agenda_items for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_id and public.can_see_date(m.held_on)));
create policy "agenda items admin insert" on public.meeting_agenda_items for insert to authenticated
  with check (public.is_forum_admin());
create policy "agenda items admin update" on public.meeting_agenda_items for update to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());
create policy "agenda items admin delete" on public.meeting_agenda_items for delete to authenticated
  using (public.is_forum_admin());

create policy "presentations from join date" on public.meeting_presentations for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_id and public.can_see_date(m.held_on)));
create policy "presentations admin insert" on public.meeting_presentations for insert to authenticated
  with check (public.is_forum_admin());
create policy "presentations admin update" on public.meeting_presentations for update to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());
create policy "presentations admin delete" on public.meeting_presentations for delete to authenticated
  using (public.is_forum_admin());

create policy "planners from join date" on public.meeting_planners for select to authenticated
  using (exists (select 1 from public.meetings m where m.id = meeting_id and public.can_see_date(m.held_on)));
create policy "planners admin insert" on public.meeting_planners for insert to authenticated
  with check (public.is_forum_admin());
create policy "planners admin delete" on public.meeting_planners for delete to authenticated
  using (public.is_forum_admin());

create policy "roles for active members" on public.forum_roles for select to authenticated
  using (public.is_active_member());
create policy "roles admin insert" on public.forum_roles for insert to authenticated
  with check (public.is_forum_admin());
create policy "roles admin update" on public.forum_roles for update to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());
create policy "roles admin delete" on public.forum_roles for delete to authenticated
  using (public.is_forum_admin());

-- Replace a meeting's whole run sheet in one step (the connector's set_agenda).
-- Runs as the caller, so the admin-only policies above still apply.
create or replace function public.set_meeting_agenda(p_meeting uuid, p_items jsonb)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not public.is_forum_admin() then
    raise exception 'only a forum admin can change the agenda' using errcode = '42501';
  end if;
  delete from public.meeting_agenda_items where meeting_id = p_meeting;
  insert into public.meeting_agenda_items (meeting_id, position, day, starts_at, minutes, kind, title, owner_id, details)
  select p_meeting, t.ord::int, nullif(t.i->>'day', '')::date, nullif(t.i->>'starts_at', '')::time,
         nullif(t.i->>'minutes', '')::int, t.i->>'kind', t.i->>'title',
         nullif(t.i->>'owner_id', '')::uuid, nullif(t.i->>'details', '')
    from jsonb_array_elements(p_items) with ordinality as t(i, ord);
end;
$$;
revoke execute on function public.set_meeting_agenda(uuid, jsonb) from public, anon;
grant execute on function public.set_meeting_agenda(uuid, jsonb) to authenticated;
