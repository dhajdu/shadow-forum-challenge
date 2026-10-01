-- Weekly AI analysis of each rider's WHOOP journal vs their scores (written by the
-- Monday cron with the service role). Private — a rider reads only their own.
create table if not exists public.journal_analyses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  week_of     date not null,              -- the Monday the analysis ran
  headline    text not null,
  insights    jsonb not null,             -- [{title, detail, effect}]
  suggestion  text not null,
  model       text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, week_of)
);
alter table public.journal_analyses enable row level security;
create policy "journal analyses read own" on public.journal_analyses
  for select to authenticated using (auth.uid() = user_id);
