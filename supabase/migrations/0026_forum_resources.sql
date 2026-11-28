-- Forum toolkit files (Dave, 2026-11-28): the worksheets and diagrams from the
-- Lark "Resources" page (5% Reflection, Deep Dive, Lifeline, Communication
-- Starters, Johari Window). A private bucket any active member can read;
-- only the service role uploads. Members who have left read nothing.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('forum-resources', 'forum-resources', false, 20971520, array['application/pdf', 'image/png', 'image/webp', 'image/jpeg'])
on conflict (id) do update set public = false;

drop policy if exists "forum resources read" on storage.objects;
create policy "forum resources read" on storage.objects for select to authenticated
  using (bucket_id = 'forum-resources' and public.is_active_member());
