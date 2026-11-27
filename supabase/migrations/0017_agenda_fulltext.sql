-- Agenda search without an embeddings provider (Dave, 2026-11-27: Anthropic key
-- only). meeting_chunks gets a full-text index; match_meeting_chunks() searches it.
-- It stays security invoker, so the chunk policy (can_see_date on held_on) filters
-- rows before anything reaches the model.

drop function if exists public.match_meeting_chunks(extensions.vector, int, uuid);
alter table public.meeting_chunks drop column if exists embedding;

-- Agendas mix English and Vietnamese. An English stemmer would mangle the
-- Vietnamese, so words are kept as written ('simple'), but English stop words
-- ("what", "the", "we") are dropped so a question doesn't match every chunk.
do $$
begin
  if not exists (select 1 from pg_ts_dict where dictname = 'forum_simple_en') then
    create text search dictionary public.forum_simple_en (template = pg_catalog.simple, stopwords = english);
  end if;
  if not exists (select 1 from pg_ts_config where cfgname = 'forum_search') then
    create text search configuration public.forum_search (copy = pg_catalog.simple);
    alter text search configuration public.forum_search
      alter mapping for asciiword, word, numword, asciihword, hword, numhword, hword_part, hword_asciipart, hword_numpart
      with public.forum_simple_en;
  end if;
end;
$$;

alter table public.meeting_chunks
  add column if not exists search tsvector
  generated always as (to_tsvector('public.forum_search', coalesce(content, ''))) stored;
create index if not exists meeting_chunks_search_idx on public.meeting_chunks using gin (search);

-- Any word of the question may match (OR), ranked by how well it covers it.
create or replace function public.match_meeting_chunks(
  query text,
  match_count int default 8,
  only_meeting uuid default null
)
returns table (id uuid, meeting_id uuid, held_on date, content text, rank float8)
language sql stable security invoker
set search_path = public, pg_temp
as $$
  with q as (
    select nullif(replace(plainto_tsquery('public.forum_search', coalesce(query, ''))::text, ' & ', ' | '), '')::tsquery as tsq
  )
  select c.id, c.meeting_id, c.held_on, c.content, ts_rank_cd(c.search, q.tsq)::float8 as rank
  from public.meeting_chunks c, q
  where q.tsq is not null
    and c.search @@ q.tsq
    and public.can_see_date(c.held_on)
    and (only_meeting is null or c.meeting_id = only_meeting)
  order by rank desc, c.held_on desc
  limit least(greatest(match_count, 1), 50);
$$;
revoke all on function public.match_meeting_chunks(text, int, uuid) from public, anon;
grant execute on function public.match_meeting_chunks(text, int, uuid) to authenticated, service_role;
