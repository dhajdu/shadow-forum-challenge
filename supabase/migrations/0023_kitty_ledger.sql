-- The forum kitty: a shared ledger of money in and out (Dave, 2026-11-28).
--
-- "It should allow any member to update the ledger with money in and out.
-- Every forum we pay 2.5M VND to the kitty. Vinh is the current treasurer and
-- holds the money."
--
-- Any active member may add an entry or void one; nothing is ever deleted, and
-- a void records who did it. Entries follow the dated-content rule (a member
-- sees lines from their first forum on, founding members see all), but every
-- active member sees the whole balance through kitty_balance(). Members who
-- have left see nothing. The treasurer is one row in kitty_settings, set by an
-- admin.

create table if not exists public.kitty_entries (
  id          uuid primary key default gen_random_uuid(),
  entry_on    date not null default ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  direction   text not null check (direction in ('in', 'out')),
  amount_vnd  bigint not null check (amount_vnd > 0 and amount_vnd < 1000000000000),
  category    text not null default 'other' check (category in ('dues', 'penalty', 'spend', 'other')),
  member_id   uuid references public.profiles (id) on delete set null,  -- who paid in, or who spent / was paid
  meeting_id  uuid references public.meetings (id) on delete set null,  -- the forum it is for (dues, venue)
  note        text check (note is null or char_length(note) <= 500),
  created_by  uuid not null default auth.uid() references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  voided_at   timestamptz,
  voided_by   uuid references public.profiles (id) on delete set null
);
create index if not exists kitty_entries_on_idx on public.kitty_entries (entry_on desc, created_at desc);

comment on table public.kitty_entries is
  'Forum kitty ledger. Add or void only; a voided line stays for the record.';

alter table public.kitty_entries enable row level security;

revoke insert, update, delete on table public.kitty_entries from anon, authenticated;
grant insert (entry_on, direction, amount_vnd, category, member_id, meeting_id, note) on table public.kitty_entries to authenticated;
grant update (voided_at) on table public.kitty_entries to authenticated;

create policy "kitty read from join date" on public.kitty_entries for select to authenticated
  using (public.is_active_member() and public.can_see_date(entry_on));

create policy "kitty add as yourself" on public.kitty_entries for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and voided_at is null
    and public.is_active_member()
    and public.can_see_date(entry_on)
  );

create policy "kitty void" on public.kitty_entries for update to authenticated
  using (public.is_active_member() and voided_at is null and public.can_see_date(entry_on))
  with check (voided_at is not null);

-- A void stamps who did it and can never be undone.
create or replace function public.kitty_entry_void()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.voided_at is not null then
    raise exception 'kitty entry already voided';
  end if;
  new.voided_at := now();
  new.voided_by := auth.uid();
  return new;
end;
$$;

drop trigger if exists kitty_entry_void on public.kitty_entries;
create trigger kitty_entry_void before update on public.kitty_entries
  for each row execute function public.kitty_entry_void();

-- Balance for every active member, including lines dated before they joined.
create or replace function public.kitty_balance()
returns bigint
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case when public.is_active_member() or coalesce(auth.role() = 'service_role', false) then
    coalesce(sum(case when direction = 'in' then amount_vnd else -amount_vnd end), 0)::bigint
  end
  from public.kitty_entries
  where voided_at is null;
$$;
revoke execute on function public.kitty_balance() from public, anon;
grant execute on function public.kitty_balance() to authenticated;

-- Who holds the money. One row.
create table if not exists public.kitty_settings (
  id             boolean primary key default true check (id),
  treasurer_id   uuid references public.profiles (id) on delete set null,
  dues_vnd       bigint not null default 2500000 check (dues_vnd > 0),
  updated_at     timestamptz not null default now()
);
alter table public.kitty_settings enable row level security;
revoke insert, update, delete on table public.kitty_settings from anon, authenticated;
grant update (treasurer_id, dues_vnd) on table public.kitty_settings to authenticated;

create policy "kitty settings read" on public.kitty_settings for select to authenticated
  using (public.is_active_member());
create policy "kitty settings admin" on public.kitty_settings for update to authenticated
  using (public.is_forum_admin()) with check (public.is_forum_admin());

insert into public.kitty_settings (id, treasurer_id)
select true, (select id from public.profiles where full_name ilike 'Vinh%' order by created_at limit 1)
on conflict (id) do nothing;
