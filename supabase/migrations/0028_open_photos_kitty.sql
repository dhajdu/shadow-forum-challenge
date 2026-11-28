-- Who sees what, as amended in Constitution version 2 (Dave, 2026-11-28):
-- "new members only get access to forum sessions and goals from the day they
-- join going forward. Anything else, pictures or the kitty, or resources, they
-- get full access to."
--
-- So photos and every kitty line are open to all active members. Forum sessions
-- (meetings, agendas, files, the Parking Lot, coaching notes), the chat and
-- goals/seasons keep the join-date rule. Resources were already open
-- (forum-resources bucket, library docs). Members who have left still see
-- nothing, and posting rules are unchanged: a member still cannot post a photo
-- or a kitty line dated before their first forum.

-- Photos: every active member sees every photo and its files.
drop policy if exists "gallery from join date" on public.gallery_photos;
create policy "gallery for members" on public.gallery_photos for select to authenticated
  using (public.is_active_member());

create or replace function public.can_see_gallery_object(object_name text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_active_member() and exists (
    select 1 from public.gallery_photos p
    where p.id = public.gallery_object_photo(object_name)
  );
$$;

-- Kitty: every active member reads every line, not only those since they joined.
drop policy if exists "kitty read from join date" on public.kitty_entries;
create policy "kitty read for members" on public.kitty_entries for select to authenticated
  using (public.is_active_member());
