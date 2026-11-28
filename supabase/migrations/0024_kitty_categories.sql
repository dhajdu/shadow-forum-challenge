-- Kitty money-out categories (Dave, 2026-11-28): "Money out should have
-- categories: Retreat, Forum Away, After Forum, Space Rental." Money in keeps
-- Forum dues and Contest penalty; Other stays for both. The old catch-all
-- 'spend' becomes 'other'.

update public.kitty_entries set category = 'other' where category = 'spend';

alter table public.kitty_entries drop constraint if exists kitty_entries_category_check;
alter table public.kitty_entries add constraint kitty_entries_category_check
  check (category in ('dues', 'penalty', 'retreat', 'forum_away', 'after_forum', 'space_rental', 'other'));

-- Money in is dues, a penalty or other; money out is one of the spend kinds or other.
alter table public.kitty_entries drop constraint if exists kitty_entries_category_direction_check;
alter table public.kitty_entries add constraint kitty_entries_category_direction_check
  check (
    (direction = 'in' and category in ('dues', 'penalty', 'other'))
    or (direction = 'out' and category in ('retreat', 'forum_away', 'after_forum', 'space_rental', 'other'))
  );
