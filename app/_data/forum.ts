/**
 * Forum data: the one module the Home, Forum, Ask and admin pages read from.
 *
 * Two sources with the same functions:
 * - `fixtures.ts`: typed placeholder rows (no real forum content), which apply the access rule
 *   in code so every persona can be checked before the database has the tables.
 * - `live.ts`: real queries against shadow-api's migration 0012 (meetings, meeting_docs,
 *   library_docs, seasons, profiles.forum_* columns, set_member_access). Every query runs on the
 *   member's own session, so Postgres RLS (can_see_date / can_see_season / audience) does the
 *   filtering and the page never does.
 *
 * Switching to the database is this one line, once 0012 is applied and lib/database.types.ts
 * is regenerated.
 */
import * as fixtures from "./fixtures";
import * as live from "./live";

export const SOURCE = "live" as "fixtures" | "live";

const impl = SOURCE === "live" ? live : fixtures;

export * from "./types";

export const getViewer = impl.getViewer;
export const listMeetings = impl.listMeetings;
export const getMeeting = impl.getMeeting;
export const searchMeetings = impl.searchMeetings;
export const listUpcoming = impl.listUpcoming;
export const listLibrary = impl.listLibrary;
export const getLibraryDoc = impl.getLibraryDoc;
export const listSeasons = impl.listSeasons;
export const getModerator = impl.getModerator;
export const listMembers = impl.listMembers;
export const getMember = impl.getMember;
export const setMemberAccess = impl.setMemberAccess;
export const listAllSeasons = impl.listAllSeasons;
export const createSeason = impl.createSeason;
export const previewAs = impl.previewAs;
export const touchLastSeen = impl.touchLastSeen;
