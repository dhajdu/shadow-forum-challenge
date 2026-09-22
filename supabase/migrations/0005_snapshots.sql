-- Daily standings snapshots (written by the Steward) — powers month-over-month
-- movement in the Chronicler's report.
create table if not exists public.standings_snapshots (
  id         uuid primary key default gen_random_uuid(),
  day        date not null unique,
  data       jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.standings_snapshots enable row level security;
create policy "snapshots read" on public.standings_snapshots
  for select to authenticated using (true);
