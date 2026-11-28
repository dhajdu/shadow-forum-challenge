-- Goal-scored contests (Forum Manager plan, "Fun", 2026-11-28).
--
-- Until now the contest scored only WHOOP data, so a forum without WHOOP had
-- no contest. Now each season sets its own rules on its row:
--   contest_name   what the forum calls it ("Race to the retreat")
--   scoring        'goals' (goal check-ins), 'whoop' (the WHOOP race) or 'both';
--                  null means the forum has not picked a contest yet
--   checkin_days   the check-in rhythm: 7 (weekly, the default), 14 or 28
--   points_*       10 per check-in, up to 50 for progress toward the goal's
--                  target (scaled by current / target), 10 streak bonus for a
--                  check-in in back-to-back periods, 100 for hitting the goal
--   missed_checkin_fine  optional kitty fine per missed check-in (off: null)
--   missed_goal_fine, coach_share_fine  what a missed goal costs the rider and
--                  their coach (Q4 2026: 5M VND each, settled by hand)
-- All amounts are whole units of the forum's currency (forum_settings.currency).
-- The placement ladder moves from millions to whole units too.
--
-- goal_checkins: a member's check-in on their contest goal (date, measure
-- value, note). Members see check-ins for seasons they can see; each member
-- writes only their own, for their own goal, today, inside the season.
--
-- season_goal_board: one row per contest goal, with its check-ins, for the
-- leaderboard (security_invoker, so goals and check-ins RLS apply). Points are
-- computed in lib/goal-points.ts.
--
-- contest_fines + book_checkin_fine(): a missed check-in, when the season sets
-- a fine, becomes one kitty line (category 'penalty', like other contest
-- stakes), at most once per member and period. Service role only.
--
-- The Shadow Forum's Q4 2026 keeps its WHOOP race exactly as before: scoring
-- 'whoop', named "Race Into the Shadow", no check-in fines. Q1 2027 stays
-- without a contest until the forum picks one.

-- ─────────────────────────────────────────────────────────
-- Season rules
alter table public.seasons add column if not exists contest_name text
  check (contest_name is null or char_length(contest_name) between 1 and 60);
alter table public.seasons add column if not exists scoring text
  check (scoring is null or scoring in ('goals', 'whoop', 'both'));
alter table public.seasons add column if not exists checkin_days int not null default 7
  check (checkin_days in (7, 14, 28));
alter table public.seasons add column if not exists points_checkin int not null default 10
  check (points_checkin between 0 and 1000);
alter table public.seasons add column if not exists points_progress int not null default 50
  check (points_progress between 0 and 1000);
alter table public.seasons add column if not exists points_streak int not null default 10
  check (points_streak between 0 and 1000);
alter table public.seasons add column if not exists points_goal int not null default 100
  check (points_goal between 0 and 10000);
alter table public.seasons add column if not exists missed_checkin_fine bigint
  check (missed_checkin_fine is null or (missed_checkin_fine > 0 and missed_checkin_fine < 1000000000000));
alter table public.seasons add column if not exists missed_goal_fine bigint
  check (missed_goal_fine is null or (missed_goal_fine > 0 and missed_goal_fine < 1000000000000));
alter table public.seasons add column if not exists coach_share_fine bigint
  check (coach_share_fine is null or (coach_share_fine > 0 and coach_share_fine < 1000000000000));

-- The ladder was in millions; it is now whole units. Convert ladders still in millions.
update public.seasons
   set ladder = (select jsonb_agg((x::numeric * 1000000)::bigint order by i) from jsonb_array_elements_text(ladder) with ordinality t(x, i))
 where jsonb_typeof(ladder) = 'array'
   and jsonb_array_length(ladder) > 0
   and (select max(x::numeric) from jsonb_array_elements_text(ladder) t(x)) < 1000;

-- A season that already had a ladder ran the WHOOP race.
update public.seasons set scoring = 'whoop'
 where scoring is null and jsonb_typeof(ladder) = 'array' and jsonb_array_length(ladder) > 0;

-- The Shadow Forum's Q4 2026, as it has run: the name and the goal stakes from the rules page.
update public.seasons
   set contest_name = coalesce(contest_name, 'Race Into the Shadow'),
       missed_goal_fine = coalesce(missed_goal_fine, 5000000),
       coach_share_fine = coalesce(coach_share_fine, 5000000)
 where slug = '2026-q4';

comment on column public.seasons.scoring is
  'Contest scoring: goals (check-ins), whoop (WHOOP race) or both. Null: no contest picked.';
comment on column public.seasons.ladder is
  'Placement stakes, whole units of the forum currency: 1st pays ladder[0], and so on.';

-- Placement penalties in whole units (amount_m stays for old readers: millions).
alter table public.penalties add column if not exists amount bigint;
update public.penalties set amount = amount_m::bigint * 1000000 where amount is null;

-- ─────────────────────────────────────────────────────────
-- Check-ins
create table if not exists public.goal_checkins (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references public.goals (id) on delete cascade,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  checked_on  date not null default public.forum_today(),
  value       numeric not null check (value > -1e15 and value < 1e15),
  note        text check (note is null or char_length(note) <= 500),
  created_at  timestamptz not null default now(),
  unique (goal_id, checked_on)
);
create index if not exists goal_checkins_user_idx on public.goal_checkins (user_id, checked_on desc);

comment on table public.goal_checkins is
  'A member''s check-in on their contest goal: the measure value on a day and a note.';

alter table public.goal_checkins enable row level security;

revoke all on table public.goal_checkins from anon, authenticated;
grant select on table public.goal_checkins to authenticated;
grant insert (goal_id, user_id, checked_on, value, note) on table public.goal_checkins to authenticated;
grant update (value, note) on table public.goal_checkins to authenticated;
grant all on table public.goal_checkins to service_role;

-- A check-in may be written for this goal today: the member's own goal, in a
-- season they can see, and today is inside that season.
create or replace function public.can_check_in(g uuid, d date)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_active_member()
     and d = public.forum_today()
     and exists (
       select 1
         from public.goals x
         join public.seasons s on s.id = x.season_id
        where x.id = g
          and x.user_id = auth.uid()
          and public.can_see_season(x.season_id)
          and d between s.starts_on and s.ends_on
     );
$$;
revoke all on function public.can_check_in(uuid, date) from public, anon;
grant execute on function public.can_check_in(uuid, date) to authenticated, service_role;

create policy "checkins in visible seasons" on public.goal_checkins for select to authenticated
  using (
    public.is_active_member()
    and exists (select 1 from public.goals g where g.id = goal_id and public.can_see_season(g.season_id))
  );
create policy "checkins add own" on public.goal_checkins for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_check_in(goal_id, checked_on));
create policy "checkins edit own today" on public.goal_checkins for update to authenticated
  using (user_id = (select auth.uid()) and public.can_check_in(goal_id, checked_on))
  with check (user_id = (select auth.uid()) and public.can_check_in(goal_id, checked_on));

-- The newest check-in is the goal's current value, so the goal card and the board agree.
create or replace function public.goal_checkin_sync()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1 from public.goal_checkins c
     where c.goal_id = new.goal_id and c.checked_on > new.checked_on
  ) then
    update public.goals g
       set current_value = new.value,
           current_progress = case
             when g.target_value is null or g.target_value <= 0 then g.current_progress
             else greatest(0, least(100, round(new.value / g.target_value * 100)))::int
           end
     where g.id = new.goal_id;
  end if;
  return new;
end;
$$;
revoke all on function public.goal_checkin_sync() from public, anon, authenticated;

drop trigger if exists goal_checkin_sync on public.goal_checkins;
create trigger goal_checkin_sync after insert or update of value on public.goal_checkins
  for each row execute function public.goal_checkin_sync();

-- ─────────────────────────────────────────────────────────
-- The goal board: one row per contest goal, with its check-ins (oldest first).
create or replace view public.season_goal_board
with (security_invoker = true) as
select
  g.season_id,
  g.id as goal_id,
  g.user_id,
  coalesce(nullif(p.full_name, ''), 'Rider') as full_name,
  g.title,
  g.unit,
  g.target_value::float8 as target_value,
  g.current_value::float8 as current_value,
  g.current_status,
  g.created_at as goal_set_at,
  p.forum_joined_on,
  p.forum_left_on,
  coalesce((
    select jsonb_agg(jsonb_build_object('on', c.checked_on, 'value', c.value::float8) order by c.checked_on)
      from public.goal_checkins c
     where c.goal_id = g.id
  ), '[]'::jsonb) as checkins
from public.goals g
join public.profiles p on p.id = g.user_id;

grant select on public.season_goal_board to authenticated, service_role;

-- ─────────────────────────────────────────────────────────
-- Missed check-in fines: one kitty line per member and period, never twice.
create table if not exists public.contest_fines (
  season_id       uuid not null references public.seasons (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  period_start    date not null,
  amount          bigint not null check (amount > 0),
  kitty_entry_id  uuid references public.kitty_entries (id) on delete set null,
  created_at      timestamptz not null default now(),
  primary key (season_id, user_id, period_start)
);
comment on table public.contest_fines is
  'Missed check-in fines already booked to the kitty, so the cron never books one twice.';

alter table public.contest_fines enable row level security;
revoke all on table public.contest_fines from anon, authenticated;
grant select on table public.contest_fines to authenticated;
grant all on table public.contest_fines to service_role;

create policy "fines in visible seasons" on public.contest_fines for select to authenticated
  using (public.is_active_member() and public.can_see_season(season_id));

-- Book one missed check-in. Returns the kitty line's id, or null if it was booked before.
-- Only for a season whose rules set a fine, for a period that has ended.
create or replace function public.book_checkin_fine(p_season uuid, p_user uuid, p_period_start date, p_period_end date, p_note text)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  s public.seasons;
  fine bigint;
  booker uuid;
  entry uuid;
begin
  select * into s from public.seasons where id = p_season;
  fine := s.missed_checkin_fine;
  if fine is null or coalesce(s.scoring, '') not in ('goals', 'both') then
    raise exception 'season % has no check-in fine', p_season;
  end if;
  if p_period_start < s.starts_on or p_period_end > s.ends_on or p_period_end >= public.forum_today() then
    raise exception 'period % to % is not a finished period of the season', p_period_start, p_period_end;
  end if;

  insert into public.contest_fines (season_id, user_id, period_start, amount)
  values (p_season, p_user, p_period_start, fine)
  on conflict do nothing;
  if not found then
    return null;
  end if;

  -- the line is recorded by the treasurer, else the first admin, else the member
  select coalesce(
    (select treasurer_id from public.kitty_settings where id),
    (select id from public.profiles where is_admin order by created_at limit 1),
    p_user
  ) into booker;

  insert into public.kitty_entries (entry_on, direction, amount_vnd, category, member_id, note, created_by)
  values (p_period_end, 'in', fine, 'penalty', p_user, left(p_note, 500), booker)
  returning id into entry;

  update public.contest_fines set kitty_entry_id = entry
   where season_id = p_season and user_id = p_user and period_start = p_period_start;
  return entry;
end;
$$;
revoke all on function public.book_checkin_fine(uuid, uuid, date, date, text) from public, anon, authenticated;
grant execute on function public.book_checkin_fine(uuid, uuid, date, date, text) to service_role;
