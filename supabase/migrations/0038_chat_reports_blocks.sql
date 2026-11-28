-- Report and block in the forum chat (App Store guideline 1.2).
--
-- chat_reports: a member reports a message. The server (POST /api/forum/report)
-- writes the row with the service role, keeps a copy of the text as it was when
-- reported (the author may edit or delete it afterwards), and tells the admins.
-- Admins read the reports; nobody else does. Additive only.
--
-- member_blocks: a member blocks another member. The blocker's apps hide the
-- blocked member's messages. Each member reads and writes only their own rows.

-- ─────────────────────────────────────────────────────────
create table if not exists public.chat_reports (
  id           uuid primary key default gen_random_uuid(),
  message_id   uuid references public.forum_messages (id) on delete set null,
  reporter_id  uuid references public.profiles (id) on delete set null,
  author_id    uuid references public.profiles (id) on delete set null,
  body         text not null default '' check (char_length(body) <= 4000),
  reason       text check (reason is null or char_length(reason) <= 500),
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  uuid references public.profiles (id) on delete set null
);
create index if not exists chat_reports_created_idx on public.chat_reports (created_at desc);

comment on table public.chat_reports is
  'Reported chat messages. Written by the server with the service role; read by forum admins.';
comment on column public.chat_reports.body is
  'The message text when it was reported.';

alter table public.chat_reports enable row level security;
revoke all on table public.chat_reports from anon, authenticated;
grant select on table public.chat_reports to authenticated;

create policy "chat reports for admins" on public.chat_reports for select to authenticated
  using (public.is_forum_admin());

-- ─────────────────────────────────────────────────────────
create table if not exists public.member_blocks (
  blocker_id  uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index if not exists member_blocks_blocked_idx on public.member_blocks (blocked_id);

comment on table public.member_blocks is
  'Members a member has blocked. The blocker''s apps hide the blocked member''s chat messages. Owner only.';

alter table public.member_blocks enable row level security;
revoke all on table public.member_blocks from anon, authenticated;
grant select, delete on table public.member_blocks to authenticated;
grant insert (blocked_id) on table public.member_blocks to authenticated;

create policy "blocks own read" on public.member_blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy "blocks own add" on public.member_blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()) and public.is_active_member());
create policy "blocks own remove" on public.member_blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));
