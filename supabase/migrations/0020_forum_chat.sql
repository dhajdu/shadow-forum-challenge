-- Forum group chat: one channel for the whole forum, under the same rule as
-- agendas. A message is visible only to members who can see the day it was sent
-- (Vietnam time), so a newcomer reads chat from their first forum on and a
-- member who has left reads nothing. Realtime postgres-changes respects RLS, so
-- clients subscribe on the member's own session.

create table if not exists public.forum_messages (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body         text not null,
  photo_id     uuid references public.gallery_photos (id) on delete set null,
  reply_to     uuid references public.forum_messages (id) on delete set null,
  created_at   timestamptz not null default now(),
  sent_on      date not null default ((now() at time zone 'Asia/Ho_Chi_Minh')::date),
  edited_at    timestamptz,
  deleted_at   timestamptz,
  notified_at  timestamptz,          -- set by the server when the chat push went out
  -- live messages carry 1-4000 characters; a soft-deleted one keeps no content
  check ((deleted_at is null and char_length(body) between 1 and 4000) or (deleted_at is not null and body = ''))
);
create index if not exists forum_messages_created_idx on public.forum_messages (created_at desc);

comment on column public.forum_messages.sent_on is
  'Day the message was sent, Vietnam time. The access rule reads this (can_see_date).';

alter table public.forum_messages enable row level security;

-- Clients may change only the body (edit) and deleted_at (soft delete).
revoke update on table public.forum_messages from anon, authenticated;
grant update (body, deleted_at) on table public.forum_messages to authenticated;
revoke insert on table public.forum_messages from anon, authenticated;
grant insert (body, photo_id, reply_to) on table public.forum_messages to authenticated;

create policy "chat from join date" on public.forum_messages for select to authenticated
  using (public.can_see_date(sent_on));

-- A linked photo or replied-to message must be one the author can see (the
-- subqueries run under those tables' policies). reply_to is qualified with the
-- table name: unqualified, it would bind to the subquery's own row.
create policy "chat post as yourself" on public.forum_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_active_member()
    and public.can_see_date(sent_on)
    and (photo_id is null or exists (select 1 from public.gallery_photos p where p.id = photo_id))
    and (forum_messages.reply_to is null
         or exists (select 1 from public.forum_messages m where m.id = forum_messages.reply_to))
  );

create policy "chat edit own" on public.forum_messages for update to authenticated
  using (author_id = (select auth.uid()) and public.is_active_member() and deleted_at is null)
  with check (author_id = (select auth.uid()));

-- Admins may only soft-delete someone else's message, never rewrite it.
create policy "chat admin delete" on public.forum_messages for update to authenticated
  using (public.is_forum_admin() and deleted_at is null and public.can_see_date(sent_on))
  with check (public.is_forum_admin() and deleted_at is not null);

-- Edits stamp edited_at; a soft delete wipes the content and cannot be undone.
create or replace function public.forum_message_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is not null then
    raise exception 'message already deleted' using errcode = '42501';
  end if;
  if new.deleted_at is not null then
    new.deleted_at := now();
    new.body := '';
    new.photo_id := null;
  elsif new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
drop trigger if exists forum_messages_update on public.forum_messages;
create trigger forum_messages_update before update on public.forum_messages
  for each row execute function public.forum_message_update();

-- Realtime: new, edited and deleted messages stream to subscribers under RLS.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'forum_messages'
  ) then
    alter publication supabase_realtime add table public.forum_messages;
  end if;
end;
$$;

-- ─────────────────────────────────────────────────────────
-- Unread counts: when each member last read the chat. Owner only.
create table if not exists public.forum_read_marks (
  user_id       uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  last_read_at  timestamptz not null default now()
);
alter table public.forum_read_marks enable row level security;

create policy "read marks own" on public.forum_read_marks for all to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member())
  with check (user_id = (select auth.uid()) and public.is_active_member());
