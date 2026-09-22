-- The Shadow Forum — initial schema
-- Five-member Q4 2026 accountability app: profiles, goals, WHOOP scores,
-- uploads, coaching notes, kitty penalties. RLS on every table.

-- ─────────────────────────────────────────────────────────
-- profiles: one row per auth user
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text not null default '',
  email       text,
  avatar_url  text,
  is_coach    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- goals: one locked Q4 goal per user (set at first login)
create table if not exists public.goals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references public.profiles (id) on delete cascade,
  title       text not null,
  measure     text,
  target_date date,
  coach_id    uuid references public.profiles (id) on delete set null,
  locked      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- goal_progress: append-only progress log the rider updates over time
create table if not exists public.goal_progress (
  id          uuid primary key default gen_random_uuid(),
  goal_id     uuid not null references public.goals (id) on delete cascade,
  progress    int  not null check (progress between 0 and 100),
  status      text not null check (status in ('on_track','at_risk','behind','hit')),
  note        text,
  created_at  timestamptz not null default now()
);

-- whoop_days: one row per rider per day
create table if not exists public.whoop_days (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  day         date not null,
  score       numeric,          -- the ranked metric for the day
  recovery    numeric,
  strain      numeric,
  resting_hr  numeric,
  hrv         numeric,
  missed      boolean not null default false,
  upload_id   uuid,
  created_at  timestamptz not null default now(),
  unique (user_id, day)
);

-- uploads: WHOOP export files landed in Storage
create table if not exists public.uploads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  file_path   text not null,
  file_name   text not null,
  status      text not null default 'uploaded' check (status in ('uploaded','processing','parsed','error')),
  rows_ingested int,
  created_at  timestamptz not null default now()
);

-- coaching_notes: notes tied to a goal, authored by rider or coach
create table if not exists public.coaching_notes (
  id            uuid primary key default gen_random_uuid(),
  goal_id       uuid not null references public.goals (id) on delete cascade,
  author_id     uuid not null references public.profiles (id) on delete cascade,
  body          text not null,
  session_month text,           -- e.g. '2026-11'
  created_at    timestamptz not null default now()
);

-- penalties: the kitty ledger (written by agents / service role)
create table if not exists public.penalties (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  kind        text not null check (kind in ('placement','missed_goal','coach_share')),
  amount_m    int  not null,     -- millions
  reason      text,
  period      text,              -- e.g. 'Q4-2026'
  created_at  timestamptz not null default now()
);

create index if not exists whoop_days_user_day_idx on public.whoop_days (user_id, day);
create index if not exists goal_progress_goal_idx  on public.goal_progress (goal_id, created_at desc);

-- ─────────────────────────────────────────────────────────
-- new auth user → profile row
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────
-- RLS: this is a trusted group of five. Standings-relevant tables are
-- readable by any authenticated member; writes are owner-scoped.
alter table public.profiles      enable row level security;
alter table public.goals         enable row level security;
alter table public.goal_progress enable row level security;
alter table public.whoop_days    enable row level security;
alter table public.uploads       enable row level security;
alter table public.coaching_notes enable row level security;
alter table public.penalties     enable row level security;

-- profiles: everyone reads (names for standings/coach); you edit your own
create policy "profiles read"        on public.profiles for select to authenticated using (true);
create policy "profiles update own"  on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- goals: everyone reads (standings show goals); you create your own once
create policy "goals read"        on public.goals for select to authenticated using (true);
create policy "goals insert own"  on public.goals for insert to authenticated with check (auth.uid() = user_id);
create policy "goals update own"  on public.goals for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- goal_progress: rider (goal owner) or that goal's coach can read; owner writes
create policy "progress read own or coach" on public.goal_progress for select to authenticated
  using (exists (
    select 1 from public.goals g
    where g.id = goal_id and (g.user_id = auth.uid() or g.coach_id = auth.uid())
  ));
create policy "progress insert own" on public.goal_progress for insert to authenticated
  with check (exists (select 1 from public.goals g where g.id = goal_id and g.user_id = auth.uid()));

-- whoop_days: everyone reads (averages drive the race); you write your own
create policy "whoop read"       on public.whoop_days for select to authenticated using (true);
create policy "whoop write own"  on public.whoop_days for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- uploads: owner only
create policy "uploads own" on public.uploads for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- coaching_notes: goal owner or coach reads; either writes as themselves
create policy "notes read own or coach" on public.coaching_notes for select to authenticated
  using (exists (
    select 1 from public.goals g
    where g.id = goal_id and (g.user_id = auth.uid() or g.coach_id = auth.uid())
  ));
create policy "notes insert as author" on public.coaching_notes for insert to authenticated
  with check (author_id = auth.uid() and exists (
    select 1 from public.goals g
    where g.id = goal_id and (g.user_id = auth.uid() or g.coach_id = auth.uid())
  ));

-- penalties: everyone reads (shared kitty); only service role writes
create policy "penalties read" on public.penalties for select to authenticated using (true);
