-- Ask AI keeps conversations (Dave, 2026-11-28: "it should have conversations").
-- Each Ask message belongs to a conversation; a new conversation starts fresh, so
-- the AI only sees that conversation's history. Existing history is split into
-- conversations wherever a member paused for more than three hours.

alter table public.chat_messages add column if not exists conversation_id uuid;

with gaps as (
  select id, user_id, created_at,
         case when lag(created_at) over (partition by user_id order by created_at) is null
                or created_at - lag(created_at) over (partition by user_id order by created_at) > interval '3 hours'
              then 1 else 0 end as starts
  from public.chat_messages
  where conversation_id is null
), numbered as (
  select id, user_id, sum(starts) over (partition by user_id order by created_at) as n from gaps
), ids as (
  select user_id, n, gen_random_uuid() as cid from numbered group by user_id, n
)
update public.chat_messages c set conversation_id = ids.cid
from numbered join ids using (user_id, n)
where c.id = numbered.id;

alter table public.chat_messages alter column conversation_id set default gen_random_uuid();
alter table public.chat_messages alter column conversation_id set not null;
create index if not exists chat_messages_conversation_idx on public.chat_messages (user_id, conversation_id, created_at);
