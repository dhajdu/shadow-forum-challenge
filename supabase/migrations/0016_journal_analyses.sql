-- Catch-up: journal_analyses existed in production with no repo migration (it was
-- created from the SQL editor). This records it exactly as production has it, so
-- local and branch databases match, then puts it under the forum access rule.
--
-- Weekly WHOOP-journal analyses, one per member per week. Owner-only. Written by
-- the service role; read by the iPhone app on the member's session.

create table if not exists public.journal_analyses (
  id          uuid not null default gen_random_uuid(),
  user_id     uuid not null,
  week_of     date not null,
  headline    text not null,
  insights    jsonb not null,
  suggestion  text not null,
  model       text not null,
  created_at  timestamptz not null default now(),
  constraint journal_analyses_pkey primary key (id),
  constraint journal_analyses_user_id_week_of_key unique (user_id, week_of),
  constraint journal_analyses_user_id_fkey foreign key (user_id) references public.profiles (id) on delete cascade
);

alter table public.journal_analyses enable row level security;

-- Owner only, and only while a member: a member who has left reads nothing.
drop policy if exists "journal analyses read own" on public.journal_analyses;
create policy "journal analyses read own" on public.journal_analyses for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member());
