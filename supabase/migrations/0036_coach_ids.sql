-- Coach roster by member id, not name (security review H2).
--
-- forum_settings.coaches mapped a rider's normalised full name to their coach's
-- full name, and lib/coach.ts set goals.coach_id to whichever profile carried
-- that name. Members edit their own name, so a member could rename themselves
-- after a colleague's coach and become that colleague's coach, with read access
-- to their coaching and progress notes.
--
-- Now coaches maps rider id → coach id (profiles.id, as text). Only admins
-- write it (column grant and policy from 0033), and this check refuses names,
-- unknown ids and self-coaching. Names never decide a coach again.

-- Convert the current roster. A name that matches exactly one profile becomes
-- its id; anything else is dropped (and reported) for an admin to set again.
do $$
declare
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  r record;
  out jsonb := '{}'::jsonb;
  rider text;
  coach text;
begin
  for r in select e.key, e.value from public.forum_settings s, jsonb_each_text(s.coaches) e where s.id loop
    rider := case when r.key ~* uuid_re then r.key else (
      select case when count(*) = 1 then (array_agg(p.id::text))[1] end from public.profiles p
       where lower(regexp_replace(trim(p.full_name), '\s+', ' ', 'g')) = lower(regexp_replace(trim(r.key), '\s+', ' ', 'g'))
    ) end;
    coach := case when r.value ~* uuid_re then r.value else (
      select case when count(*) = 1 then (array_agg(p.id::text))[1] end from public.profiles p
       where lower(regexp_replace(trim(p.full_name), '\s+', ' ', 'g')) = lower(regexp_replace(trim(r.value), '\s+', ' ', 'g'))
    ) end;
    if rider is null or coach is null or rider = coach then
      raise notice 'coach roster: dropped "%" → "%" (no single matching profile)', r.key, r.value;
    else
      out := out || jsonb_build_object(lower(rider), lower(coach));
    end if;
  end loop;
  update public.forum_settings set coaches = out where id and coaches is distinct from out;
end;
$$;

comment on column public.forum_settings.coaches is
  'Contest coach roster: rider profile id → coach profile id. Admins only. Never keyed by name.';

create or replace function public.forum_settings_coaches_check()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if exists (
    select 1 from jsonb_each(new.coaches) e
     where jsonb_typeof(e.value) <> 'string'
        or e.key !~ uuid_re
        or (e.value #>> '{}') !~ uuid_re
        or e.key = (e.value #>> '{}')
        or not exists (select 1 from public.profiles p where p.id::text = e.key)
        or not exists (select 1 from public.profiles p where p.id::text = (e.value #>> '{}'))
  ) then
    raise exception 'coaches must map a member''s id to another member''s id (lower-case uuids)' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.forum_settings_coaches_check() from public, anon, authenticated;

drop trigger if exists forum_settings_coaches_check on public.forum_settings;
create trigger forum_settings_coaches_check before insert or update of coaches on public.forum_settings
  for each row execute function public.forum_settings_coaches_check();
