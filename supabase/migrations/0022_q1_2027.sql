-- Q1 2027 and personal goals per season (Dave, 2026-11-27).
--
-- "Q1 starts on January 1st. The first forum is January 13th. ... We haven't
-- picked the contest yet." So Q1 runs 1 Jan to 31 Mar with no contest yet
-- (metric and ladder null), and every member, Daniel included, is in it.
--
-- Season rule, changed with Dave's OK: a season is visible to an active member
-- if it is still running on or after their first forum (ends_on >= join date),
-- not only if it started after it. Q4 2026 (ends 22 Dec) stays hidden from Minh
-- Anh (23 Dec) and Daniel (13 Jan); Q1 2027 is visible to all seven. Dated
-- content keeps its own rule: agendas, coaching notes, chat and photos still use
-- can_see_date.

create or replace function public.member_can_see_season(uid uuid, s uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.member_is_active(uid) and exists (
    select 1
    from public.seasons x
    join public.profiles p on p.id = uid
    where x.id = s
      and (p.is_founding or (p.forum_joined_on is not null and p.forum_joined_on <= x.ends_on))
  );
$$;

-- Riders of a season follow the same test (without the left-on check, so a
-- member who leaves stays on that season's board).
create or replace view public.season_standings
with (security_invoker = true) as
with riders as (
  select s.id as season_id, s.starts_on, s.ends_on, p.id as user_id, p.full_name
  from public.seasons s
  join public.profiles p
    on p.is_founding or (p.forum_joined_on is not null and p.forum_joined_on <= s.ends_on)
  where public.can_see_season(s.id)
),
scored as (
  select user_id, day, score from public.whoop_days where score is not null
),
agg as (
  select
    r.season_id,
    r.starts_on,
    r.ends_on,
    r.user_id,
    coalesce(nullif(r.full_name, ''), 'Rider') as full_name,
    avg(c.score) filter (where c.day between r.starts_on and r.ends_on) as contest_avg,
    count(c.day) filter (where c.day between r.starts_on and r.ends_on) as contest_days,
    max(c.day) filter (where c.day between r.starts_on and r.ends_on) as contest_last,
    avg(c.score) as all_avg,
    count(c.day) as all_days,
    max(c.day) as last_day
  from riders r
  left join scored c on c.user_id = r.user_id
  group by r.season_id, r.starts_on, r.ends_on, r.user_id, r.full_name
)
select
  a.user_id,
  a.full_name,
  round(coalesce(a.contest_avg, 0), 1)::float8 as contest_avg,
  a.contest_days::int as contest_days,
  case
    when a.contest_last is null then 0
    else (a.contest_last - a.starts_on + 1) - a.contest_days
  end::int as contest_missed,
  round(coalesce(a.all_avg, 0), 1)::float8 as all_avg,
  a.all_days::int as all_days,
  a.last_day,
  (select max(w.day) from public.whoop_days w where w.user_id = a.user_id) as last_data_day,
  a.season_id
from agg a;

-- No contest yet: metric and ladder stay null until Dave picks one.
insert into public.seasons (slug, name, starts_on, ends_on, metric, ladder)
values ('2027-q1', 'Q1 2027', date '2027-01-01', date '2027-03-31', null, null)
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────
-- Personal goals per season: any number per member per quarter. Owner only.
alter table public.personal_goals add column if not exists season_id uuid references public.seasons (id);
update public.personal_goals
   set season_id = (select id from public.seasons where slug = '2026-q4')
 where season_id is null;
create index if not exists personal_goals_user_season_idx on public.personal_goals (user_id, season_id);

-- A season a member can see that has not ended yet (current or coming).
create or replace function public.is_open_season(s uuid)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.can_see_season(s)
     and exists (select 1 from public.seasons x where x.id = s and x.ends_on >= current_date);
$$;
revoke all on function public.is_open_season(uuid) from public, anon;
grant execute on function public.is_open_season(uuid) to authenticated, service_role;

drop policy if exists "personal own" on public.personal_goals;
create policy "personal read own" on public.personal_goals for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member());
-- New goals go into a current or future season the member can see.
create policy "personal add own" on public.personal_goals for insert to authenticated
  with check (
    user_id = (select auth.uid()) and public.is_active_member()
    and season_id is not null and public.is_open_season(season_id)
  );
create policy "personal edit own" on public.personal_goals for update to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member())
  with check (user_id = (select auth.uid()) and (season_id is null or public.can_see_season(season_id)));
create policy "personal delete own" on public.personal_goals for delete to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member());
