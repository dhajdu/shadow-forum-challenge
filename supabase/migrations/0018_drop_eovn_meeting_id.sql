-- Dave, 2026-11-27: "There should be no code connected to EO Vietnam."
-- Meetings carry no EO Vietnam link. Dates are entered here as plain rows.
alter table public.meetings drop constraint if exists meetings_eovn_meeting_id_key;
alter table public.meetings drop column if exists eovn_meeting_id;
