-- Denormalize a public snapshot of each goal's progress onto goals so the race
-- board can show everyone's status. Detailed notes stay private in goal_progress.
alter table public.goals add column if not exists current_progress int not null default 0;
alter table public.goals add column if not exists current_status text not null default 'on_track'
  check (current_status in ('on_track','at_risk','behind','hit'));
