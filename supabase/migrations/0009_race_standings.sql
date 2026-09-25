-- Race standings: one row per rider, computed from whoop_days (the raw ingest
-- table) whenever it's read, so it's always current after an upload.
--
-- A day counts once it has a score. The newest day in an export may still be in
-- progress (recovery + sleep are final, strain is still building); the next
-- upload overwrites it with the full day.
-- missed = contest days WHOOP didn't record, from the contest start up to the
-- rider's latest scored day (days not uploaded yet don't count).
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
  user_id,
  full_name,
  round(coalesce(contest_avg, 0), 1)::float8 as contest_avg,
  contest_days::int as contest_days,
  case
    when contest_last is null then 0
    else (contest_last - date '2026-09-23' + 1) - contest_days
  end::int as contest_missed,
  round(coalesce(all_avg, 0), 1)::float8 as all_avg,
  all_days::int as all_days,
  last_day
from agg;

grant select on public.race_standings to authenticated;
