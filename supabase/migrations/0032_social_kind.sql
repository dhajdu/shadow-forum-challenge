-- A social event (a forum dinner, a party): on the calendar with a host and a place,
-- but no run sheet, presentations or rotation.
alter table public.meetings drop constraint if exists meetings_kind_check;
alter table public.meetings add constraint meetings_kind_check
  check (kind in ('forum', 'away', 'retreat', 'kickoff', 'social'));
