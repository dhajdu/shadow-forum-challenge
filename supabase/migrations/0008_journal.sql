-- WHOOP journal answers (journal_entries.csv): one row per rider per day per question.
-- Private — only the rider can read their own journal (feeds their assistant).
create table if not exists public.whoop_journal (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  day          date not null,
  question     text not null,
  answered_yes boolean,
  notes        text,
  upload_id    uuid,
  created_at   timestamptz not null default now(),
  unique (user_id, day, question)
);
create index if not exists whoop_journal_user_day_idx on public.whoop_journal (user_id, day);

alter table public.whoop_journal enable row level security;
create policy "journal own" on public.whoop_journal for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
