-- Kitty: forum fines as their own money-in category (Dave, 2026-11-28). At the
-- 25 Nov forum Dru was fined for pre-arranged call interruptions and Vinh for
-- going to the restroom out of turn. Contest penalties stay separate.

alter table public.kitty_entries drop constraint if exists kitty_entries_category_check;
alter table public.kitty_entries add constraint kitty_entries_category_check
  check (category in ('dues', 'fine', 'penalty', 'retreat', 'forum_away', 'after_forum', 'space_rental', 'other'));

alter table public.kitty_entries drop constraint if exists kitty_entries_category_direction_check;
alter table public.kitty_entries add constraint kitty_entries_category_direction_check
  check (
    (direction = 'in' and category in ('dues', 'fine', 'penalty', 'other'))
    or (direction = 'out' and category in ('retreat', 'forum_away', 'after_forum', 'space_rental', 'other'))
  );
