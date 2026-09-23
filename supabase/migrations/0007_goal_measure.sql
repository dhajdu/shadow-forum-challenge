-- Structured business-goal tracking: a unit, a target, and a current value.
-- Percentage complete is derived (current / target).
alter table public.goals add column if not exists unit text;
alter table public.goals add column if not exists target_value numeric;
alter table public.goals add column if not exists current_value numeric not null default 0;

-- Extra Credit: personal goals that do NOT count toward the contest. Owner-private.
create table if not exists public.personal_goals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  title         text not null,
  unit          text,
  target_value  numeric,
  current_value numeric not null default 0,
  created_at    timestamptz not null default now()
);
alter table public.personal_goals enable row level security;
create policy "personal read own"  on public.personal_goals for select to authenticated using (auth.uid() = user_id);
create policy "personal write own" on public.personal_goals for all    to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
