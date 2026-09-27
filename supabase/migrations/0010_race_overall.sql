-- Race ranks on each rider's overall (all-time) average. Adds last_data_day — the
-- newest day in any upload (scored or not) — so the board can flag riders who
-- haven't uploaded in over a week.
create or replace view public.race_standings
with (security_invoker = true) as
with scored as (
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
  from public.profiles p
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
