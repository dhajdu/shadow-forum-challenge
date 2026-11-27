-- Ask: per-member chat history. Owner-only, and only while a member.
-- Writes come from /api/ask on the member's own session.

create table if not exists public.chat_messages (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.profiles (id) on delete cascade,
  role               text not null check (role in ('user', 'assistant')),
  content            text not null,
  cited_meeting_ids  uuid[] not null default '{}',
  created_at         timestamptz not null default now()
);
create index if not exists chat_messages_user_idx on public.chat_messages (user_id, created_at desc);

alter table public.chat_messages enable row level security;

create policy "chat own read" on public.chat_messages for select to authenticated
  using (user_id = (select auth.uid()) and public.is_active_member());
create policy "chat own insert" on public.chat_messages for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_active_member());
create policy "chat own delete" on public.chat_messages for delete to authenticated
  using (user_id = (select auth.uid()));
