-- Account deletion (App Store guideline 5.1.1(v)). DELETE /api/account removes
-- the member's auth user; profiles and almost everything under it cascade. Two
-- things stopped that cascade:
--
-- 1. kitty_entries.created_by was "not null" but "on delete set null", so
--    deleting anyone who had written a kitty line failed. The ledger keeps the
--    line; who wrote it becomes unknown.
-- 2. forum_message_update() refuses any change to a deleted message. When a
--    member's own messages are removed, Postgres clears reply_to on the replies
--    under them, and a deleted reply made the whole deletion fail. It now lets
--    that one change through. Clients still cannot write reply_to (column
--    grants), and RLS still refuses any update to a deleted message.

alter table public.kitty_entries alter column created_by drop not null;

create or replace function public.forum_message_update()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if old.deleted_at is not null then
    -- Only the foreign key clearing reply_to (a parent message was removed).
    if new.reply_to is null and old.reply_to is not null
       and new.body = old.body and new.deleted_at = old.deleted_at
       and new.photo_id is not distinct from old.photo_id then
      return new;
    end if;
    raise exception 'message already deleted' using errcode = '42501';
  end if;
  if new.deleted_at is not null then
    new.deleted_at := now();
    new.body := '';
    new.photo_id := null;
  elsif new.body is distinct from old.body then
    new.edited_at := now();
  end if;
  return new;
end;
$$;
