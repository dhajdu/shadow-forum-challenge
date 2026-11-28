-- Parking Lot topics follow the join-date rule in the database (security review H1).
--
-- Every agenda repeats the forum's running Parking Lot, so a late joiner's first
-- agenda still lists topics raised before they joined. Only app code
-- (visibleAgendaMd in app/_data/recap.ts) dropped those topics; reading
-- meeting_docs.body_md or meeting_chunks.content straight through the API
-- returned them.
--
-- meeting_docs: the table is renamed meeting_doc_sources and members can no
-- longer read its body_md. A view named meeting_docs takes its place, so the web
-- app and the iPhone app read it as before. The view's body_md is the agenda as
-- the reader may see it (meeting_doc_body): founding members get the whole text;
-- everyone else gets the Parking Lot without topic groups dated before their
-- first forum, and without undated groups (the same rule as visibleParking).
-- Agenda imports write meeting_doc_sources.
--
-- meeting_chunks: each chunk gets visible_from. The indexer (lib/chunks.ts) cuts
-- every Parking Lot topic group into its own chunks, dated with the group's
-- date, and RLS checks that date as well as the meeting's. The database refuses
-- a Parking Lot chunk without one. The old chunks were cut from whole agendas,
-- so they are deleted here; rebuild them with GET /api/cron/chunks.

-- ─────────────────────────────────────────────────────────
-- An agenda split into runs of lines, each with the date a reader must be able
-- to see (visible_from): null for text outside the Parking Lot and for its
-- learnings, a topic group's date for that group, and 0001-01-01 (founding
-- members only) for undated and person-grouped topics. Joining every part's
-- body with newlines gives back the agenda exactly. Mirrors parseParking in
-- app/_data/recap.ts, line by line.
create or replace function public.agenda_parts(md text, held_on date)
returns table (part int, visible_from date, body text)
language plpgsql immutable
set search_path = public, pg_temp
as $$
declare
  founding_only constant date := date '0001-01-01';
  ln text;
  tr text;
  t text;
  m text[];
  state text := 'pre'; -- pre | parking | learnings | stopped | post
  grp date;            -- the current topic group's date
  v date;              -- this line's visible_from
  buf text[] := '{}';
  buf_v date;
  n int := 0;
  mon int;
  y int;
  d int;
  last_day int;
begin
  foreach ln in array string_to_array(coalesce(md, ''), E'\n') loop
    if state in ('pre', 'post') then
      if ln ~* '^##\s+parking lot' then
        state := 'parking';
        grp := founding_only; -- topics before the first group heading have no date
      end if;
      v := null;
    elsif ln ~* '^#{1,2}\s' and ln !~* '^#{1,2}\s+learnings' then
      -- the next section; it may be another Parking Lot
      state := case when ln ~* '^##\s+parking lot' then 'parking' else 'post' end;
      grp := founding_only;
      v := null;
    elsif state = 'stopped' then
      v := founding_only;
    else
      tr := btrim(ln, E' \t\r');
      t := btrim(regexp_replace(replace(ln, '**', ''), '^\s*(--|[-*+])\s*(\[[ xX]\]\s*)?', ''), E' \t\r');
      if tr ~* '^#\s*learnings' then
        state := 'learnings';
        v := null;
      elsif tr ~ '^#\s' then
        state := 'stopped'; -- parseParking stops reading here
        v := founding_only;
      elsif t = '' or t ~* '^(the radar|important\s*\|\s*urgent)$' then
        v := case when state = 'learnings' then null else grp end;
      elsif t ~* '^#?\s*learnings:?$' then
        state := 'learnings';
        v := null;
      elsif state = 'learnings' then
        v := null;
      else
        m := regexp_match(t, '^([A-Za-z]{3,9})\.?\s+(\d{1,2})(st|nd|rd|th)?:?$');
        mon := case lower(left(coalesce(m[1], ''), 3))
          when 'jan' then 1 when 'feb' then 2 when 'mar' then 3 when 'apr' then 4
          when 'may' then 5 when 'jun' then 6 when 'jul' then 7 when 'aug' then 8
          when 'sep' then 9 when 'oct' then 10 when 'nov' then 11 when 'dec' then 12
        end;
        if mon is not null then
          -- "Nov 25" in an agenda held in February is last November
          y := extract(year from held_on)::int - case when mon > extract(month from held_on)::int then 1 else 0 end;
          last_day := extract(day from (make_date(y, mon, 1) + interval '1 month - 1 day'))::int;
          d := least(greatest(m[2]::int, 1), last_day);
          grp := make_date(y, mon, d);
        elsif t ~ '^[A-Z][[:alpha:].''’]*(\s[A-Z][[:alpha:].''’]*)?$' and ln ~ '^\s*\*\*' then
          grp := founding_only; -- a person-grouped Parking Lot (early agendas)
        end if;
        v := grp;
      end if;
    end if;

    if cardinality(buf) > 0 and v is distinct from buf_v then
      n := n + 1;
      part := n; visible_from := buf_v; body := array_to_string(buf, E'\n');
      return next;
      buf := '{}';
    end if;
    buf := buf || ln;
    buf_v := v;
  end loop;
  if cardinality(buf) > 0 then
    n := n + 1;
    part := n; visible_from := buf_v; body := array_to_string(buf, E'\n');
    return next;
  end if;
end;
$$;

-- The agenda as a member with this join date may read it.
create or replace function public.visible_agenda_md(md text, held_on date, joined_on date, founding boolean)
returns text
language sql immutable
set search_path = public, pg_temp
as $$
  select case when founding then md else coalesce((
    select string_agg(p.body, E'\n' order by p.part)
      from public.agenda_parts(md, held_on) p
     where p.visible_from is null or (joined_on is not null and p.visible_from >= joined_on)
  ), '') end;
$$;

revoke all on function public.agenda_parts(text, date) from public, anon, authenticated;
revoke all on function public.visible_agenda_md(text, date, date, boolean) from public, anon, authenticated;
grant execute on function public.agenda_parts(text, date) to service_role;
grant execute on function public.visible_agenda_md(text, date, date, boolean) to service_role;

-- ─────────────────────────────────────────────────────────
-- meeting_docs → meeting_doc_sources, with a reader-specific view in its place
alter table public.meeting_docs rename to meeting_doc_sources;

comment on table public.meeting_doc_sources is
  'Imported agenda text, whole. Members read it through the meeting_docs view, never directly. Imports write here.';

revoke all on table public.meeting_doc_sources from anon;
revoke select on table public.meeting_doc_sources from authenticated;
grant select (id, meeting_id, title, source_updated_at, created_at) on table public.meeting_doc_sources to authenticated;

-- One document's body as the caller may read it. Null for a meeting the caller
-- cannot see. The service role and direct database sessions (no API role) get
-- the whole text.
create or replace function public.meeting_doc_body(doc uuid)
returns text
language sql stable security definer
set search_path = public, pg_temp
as $$
  select case
    when coalesce(auth.role(), '') = 'service_role' or (auth.role() is null and session_user <> 'authenticator') then d.body_md
    when not public.can_see_date(m.held_on) then null
    else public.visible_agenda_md(d.body_md, m.held_on, p.forum_joined_on, coalesce(p.is_founding, false))
  end
  from public.meeting_doc_sources d
  join public.meetings m on m.id = d.meeting_id
  left join public.profiles p on p.id = auth.uid()
  where d.id = doc;
$$;
revoke all on function public.meeting_doc_body(uuid) from public, anon;
grant execute on function public.meeting_doc_body(uuid) to authenticated, service_role;

-- security_invoker: the meeting_doc_sources policy ("docs from join date") still
-- picks the rows; meeting_doc_body picks what each row says.
create view public.meeting_docs with (security_invoker = true) as
  select d.id, d.meeting_id, d.title, public.meeting_doc_body(d.id) as body_md, d.source_updated_at, d.created_at
    from public.meeting_doc_sources d;

comment on view public.meeting_docs is
  'Agenda text as the signed-in member may read it: Parking Lot topics dated before their first forum are left out. Read-only for members; imports write meeting_doc_sources.';

revoke all on table public.meeting_docs from anon, authenticated;
grant select on table public.meeting_docs to authenticated;

-- ─────────────────────────────────────────────────────────
-- meeting_chunks: Parking Lot chunks carry their topic group's date
alter table public.meeting_chunks add column if not exists visible_from date;

comment on column public.meeting_chunks.visible_from is
  'For a Parking Lot chunk, its topic group''s date (0001-01-01: founding members only). Null for other agenda text.';

drop policy if exists "chunks from join date" on public.meeting_chunks;
create policy "chunks from join date" on public.meeting_chunks for select to authenticated
  using (public.can_see_date(held_on) and (visible_from is null or public.can_see_date(visible_from)));

create or replace function public.meeting_chunk_parking_guard()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.visible_from is null and new.content ~* '(^|\n)##\s+parking lot' then
    raise exception 'a Parking Lot chunk needs visible_from (index agendas with lib/chunks.ts)' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function public.meeting_chunk_parking_guard() from public, anon, authenticated;

drop trigger if exists meeting_chunks_parking_guard on public.meeting_chunks;
create trigger meeting_chunks_parking_guard before insert or update on public.meeting_chunks
  for each row execute function public.meeting_chunk_parking_guard();

-- Cut from whole agendas, Parking Lot included. GET /api/cron/chunks rebuilds them.
delete from public.meeting_chunks;
