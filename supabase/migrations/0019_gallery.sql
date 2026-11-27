-- Photo Gallery, under the same rule as agendas: a photo is visible only to
-- members who can see its date (can_see_date(taken_on)). A newcomer never sees
-- photos from before their first forum, and cannot post into that past.
--
-- The browser uploads files straight to Storage on the member's session (Vercel
-- caps API bodies at 4.5 MB). Flow: generate the id in the client
-- (crypto.randomUUID), insert the row with its three paths, upload the files to
-- gallery/<id>/..., and on failure delete the files first, then the row (file
-- deletes need the row). A nightly job
-- (/api/cron/gallery-cleanup) removes rows whose files never arrived and files
-- whose row is gone; SQL cannot delete Storage objects.

create table if not exists public.gallery_photos (
  id             uuid primary key default gen_random_uuid(),
  uploaded_by    uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  taken_on       date not null,
  meeting_id     uuid references public.meetings (id) on delete set null,
  caption        text check (caption is null or char_length(caption) <= 500),
  original_path  text not null,
  web_path       text not null,
  thumb_path     text not null,
  width          int check (width is null or width > 0),
  height         int check (height is null or height > 0),
  bytes          bigint check (bytes is null or (bytes > 0 and bytes <= 15728640)),
  created_at     timestamptz not null default now(),
  -- files live under this row's own folder, with fixed names
  check (original_path ~ ('^' || id::text || '/original\.(jpe?g|png|webp|heic|heif)$')),
  check (web_path = id::text || '/web.webp'),
  check (thumb_path = id::text || '/thumb.webp')
);
create index if not exists gallery_photos_taken_on_idx on public.gallery_photos (taken_on desc);
create index if not exists gallery_photos_meeting_idx on public.gallery_photos (meeting_id);

alter table public.gallery_photos enable row level security;

-- Members may change only the caption, date and meeting link.
revoke update on table public.gallery_photos from anon, authenticated;
grant update (caption, taken_on, meeting_id) on table public.gallery_photos to authenticated;

create policy "gallery from join date" on public.gallery_photos for select to authenticated
  using (public.can_see_date(taken_on));

-- A linked meeting must be one the caller can see (the subquery runs under the meetings policy).
create policy "gallery insert own" on public.gallery_photos for insert to authenticated
  with check (
    uploaded_by = (select auth.uid())
    and public.is_active_member()
    and public.can_see_date(taken_on)
    and (meeting_id is null or exists (select 1 from public.meetings m where m.id = meeting_id))
  );

create policy "gallery update own or admin" on public.gallery_photos for update to authenticated
  using ((uploaded_by = (select auth.uid()) or public.is_forum_admin()) and public.can_see_date(taken_on))
  with check (
    (uploaded_by = (select auth.uid()) or public.is_forum_admin())
    and public.can_see_date(taken_on)
    and (meeting_id is null or exists (select 1 from public.meetings m where m.id = meeting_id))
  );

create policy "gallery delete own or admin" on public.gallery_photos for delete to authenticated
  using ((uploaded_by = (select auth.uid()) or public.is_forum_admin()) and public.is_active_member());

-- ─────────────────────────────────────────────────────────
-- Storage: private bucket, 15 MB, images only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- The photo row an object belongs to, if the object name is one of its three files.
create or replace function public.gallery_object_photo(object_name text)
returns uuid
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  folder text := split_part(object_name, '/', 1);
  photo public.gallery_photos;
begin
  if folder !~ '^[0-9a-fA-F-]{36}$' then
    return null;
  end if;
  select * into photo from public.gallery_photos where id = folder::uuid;
  if photo.id is null or object_name not in (photo.original_path, photo.web_path, photo.thumb_path) then
    return null;
  end if;
  return photo.id;
end;
$$;
revoke all on function public.gallery_object_photo(text) from public, anon;
grant execute on function public.gallery_object_photo(text) to authenticated, service_role;

create or replace function public.can_see_gallery_object(object_name text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.gallery_photos p
    where p.id = public.gallery_object_photo(object_name) and public.can_see_date(p.taken_on)
  );
$$;

create or replace function public.owns_gallery_object(object_name text)
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select public.is_active_member() and exists (
    select 1 from public.gallery_photos p
    where p.id = public.gallery_object_photo(object_name)
      and (p.uploaded_by = auth.uid() or public.is_forum_admin())
  );
$$;
revoke all on function public.can_see_gallery_object(text) from public, anon;
revoke all on function public.owns_gallery_object(text) from public, anon;
grant execute on function public.can_see_gallery_object(text) to authenticated, service_role;
grant execute on function public.owns_gallery_object(text) to authenticated, service_role;

create policy "gallery files visible with photo" on storage.objects for select to authenticated
  using (bucket_id = 'gallery' and public.can_see_gallery_object(name));
-- Upload only the row's own three files, and only by the member who created the
-- row. No update policy, so files cannot be overwritten.
create policy "gallery files upload by uploader" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'gallery'
    and public.is_active_member()
    and exists (select 1 from public.gallery_photos p where p.id = public.gallery_object_photo(name) and p.uploaded_by = auth.uid())
  );
create policy "gallery files delete by owner or admin" on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and public.owns_gallery_object(name));
