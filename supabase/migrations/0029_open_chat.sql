-- Chat history open to every active member (Dave, 2026-11-28: "Yes, open
-- chat"). New members read the whole forum chat, including what was said
-- before they joined. Agendas, the Parking Lot, coaching notes and goals keep
-- the join-date rule. Posting is unchanged: a member still posts only from
-- their first forum on, as themselves. Members who have left see nothing.

drop policy if exists "chat from join date" on public.forum_messages;
create policy "chat for members" on public.forum_messages for select to authenticated
  using (public.is_active_member());
