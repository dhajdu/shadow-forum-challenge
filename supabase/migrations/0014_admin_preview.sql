-- Admin "Preview as member", and last-visit time for Home's "new since your last visit".

alter table public.profiles add column if not exists last_seen_at timestamptz;

-- Members cannot write last_seen_at directly (column grants allow only name and
-- avatar); they stamp their own row through this.
create or replace function public.touch_last_seen()
returns timestamptz
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  previous timestamptz;
begin
  select last_seen_at into previous from public.profiles where id = auth.uid();
  update public.profiles set last_seen_at = now() where id = auth.uid();
  return previous;
end;
$$;
revoke all on function public.touch_last_seen() from public, anon;
grant execute on function public.touch_last_seen() to authenticated;

-- What a member would see, computed with the real rule from their stored dates.
-- Admin-only. Returns ids, dates and slugs, never content.
create or replace function public.admin_preview(member uuid)
returns jsonb
language plpgsql stable security definer
set search_path = public, pg_temp
as $$
declare
  founding boolean;
  active boolean;
begin
  if not public.is_forum_admin() then
    raise exception 'only admins can preview members' using errcode = '42501';
  end if;
  select p.is_founding into founding from public.profiles p where p.id = member;
  active := public.member_is_active(member);
  return jsonb_build_object(
    'active', active,
    'meetings', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'held_on', m.held_on, 'status', m.status) order by m.held_on)
      from public.meetings m where public.member_can_see_date(member, m.held_on)
    ), '[]'::jsonb),
    'library', coalesce((
      select jsonb_agg(l.slug order by l.sort, l.slug)
      from public.library_docs l
      where active and (l.audience = 'all' or (l.audience = 'founding' and coalesce(founding, false)))
    ), '[]'::jsonb),
    'seasons', coalesce((
      select jsonb_agg(s.id order by s.starts_on)
      from public.seasons s where public.member_can_see_season(member, s.id)
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_preview(uuid) from public, anon;
grant execute on function public.admin_preview(uuid) to authenticated;
