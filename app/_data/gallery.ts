// Gallery data. Rows live in gallery_photos and files in the private "gallery" bucket. Both are
// filtered by the same rule as agendas (can_see_date(taken_on)) on the member's own session.
import type { Db } from "./types";

export const GALLERY_BUCKET = "gallery";
export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

export type GalleryPhoto = {
  id: string;
  taken_on: string;
  meeting_id: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  uploaded_by: string;
  uploader: string | null;
  thumb: string | null; // signed URLs, 1 hour
  web: string | null;
  original: string | null;
};

type Row = {
  id: string;
  taken_on: string;
  meeting_id: string | null;
  caption: string | null;
  width: number | null;
  height: number | null;
  uploaded_by: string;
  original_path: string;
  web_path: string;
  thumb_path: string;
  profiles: { full_name: string } | null;
};

/** Photos the member may see, newest first, with signed URLs. Empty until the table exists. */
export async function listGallery(db: Db, limit?: number): Promise<GalleryPhoto[]> {
  let q = db
    .from("gallery_photos")
    .select("id, taken_on, meeting_id, caption, width, height, uploaded_by, original_path, web_path, thumb_path, profiles:uploaded_by(full_name)")
    .order("taken_on", { ascending: false })
    .order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error || !data) return [];
  const rows = data as unknown as Row[];
  if (rows.length === 0) return [];
  const paths = rows.flatMap((r) => [r.thumb_path, r.web_path, r.original_path]);
  const { data: signed } = await db.storage.from(GALLERY_BUCKET).createSignedUrls(paths, 3600);
  const url = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  return rows.map((r) => ({
    id: r.id,
    taken_on: r.taken_on,
    meeting_id: r.meeting_id,
    caption: r.caption,
    width: r.width,
    height: r.height,
    uploaded_by: r.uploaded_by,
    uploader: r.profiles?.full_name ?? null,
    thumb: url.get(r.thumb_path) ?? null,
    web: url.get(r.web_path) ?? null,
    original: url.get(r.original_path) ?? null,
  }));
}
