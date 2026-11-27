-- Seasons beyond Q4 2026: one goal per member per season, and standings for any season.
--
-- Goals: unique on (user_id, season_id) instead of user_id, so a member keeps a
-- Q4 2026 goal and locks in a Q1 2027 goal. season_id is required; inserts may
-- name a season that has not started yet (the policy only needs the member to
-- be able to see it).
--
-- Standings: season_standings has one row per season and rider. race_standings
-- keeps its columns (plus season_id) and now means "the season running today"
-- (season_of(current_date)), so existing pages switch to the new season on its
-- first day without code changes.

alter table public.goals drop constraint if exists goals_user_id_key;
alter table public.goals alter column season_id set not null;
-- the season running today unless the insert names one (the insert trigger from 0012 does the same)
alter table public.goals alter column season_id set default public.season_of(current_date);
alter table public.goals add constraint goals_user_season_key unique (user_id, season_id);

-- Riders of a season: founding members, and members whose first forum was on or
-- before the season's first day (the same test as can_see_season, without the
-- left-on check, so a member who leaves mid-season stays on that season's board).
create or replace view public.season_standings
with (security_invoker = true) as
with riders as (
  select s.id as season_id, s.starts_on, s.ends_on, p.id as user_id, p.full_name
  from public.seasons s
  join public.profiles p
    on p.is_founding or (p.forum_joined_on is not null and p.forum_joined_on <= s.starts_on)
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

grant select on public.season_standings to authenticated, service_role;

-- Same columns as before, plus season_id at the end: the board for today's season.
create or replace view public.race_standings
with (security_invoker = true) as
select
  user_id, full_name, contest_avg, contest_days, contest_missed,
  all_avg, all_days, last_day, last_data_day, season_id
from public.season_standings
where season_id = public.season_of(current_date);

grant select on public.race_standings to authenticated, service_role;
