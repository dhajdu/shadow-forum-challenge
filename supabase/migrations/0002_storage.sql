-- WHOOP upload storage: a private bucket where each rider can only touch
-- their own folder (objects prefixed with their user id).

insert into storage.buckets (id, name, public)
values ('whoop', 'whoop', false)
on conflict (id) do nothing;

-- owner-scoped access: object path must start with the rider's uid
create policy "whoop upload own folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'whoop'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "whoop read own folder"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'whoop'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "whoop delete own folder"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'whoop'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
