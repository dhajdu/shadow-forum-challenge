// Nightly Gallery cleanup (service role). The browser inserts a photo row, then
// uploads its three files; if the tab closes midway, a row without files or files
// without a row are left behind. SQL cannot delete Storage objects, so this job
// does it through the Storage API. Anything younger than an hour is left alone:
// it may still be uploading.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

type Admin = SupabaseClient<Database>;
const BUCKET = "gallery";
const GRACE_MS = 60 * 60 * 1000;

export async function cleanupGallery(admin: Admin, now = Date.now()) {
  const store = admin.storage.from(BUCKET);
  const old = (iso: string | null | undefined) => !!iso && now - new Date(iso).getTime() > GRACE_MS;

  const { data: rows, error } = await admin
    .from("gallery_photos")
    .select("id, original_path, web_path, thumb_path, created_at");
  if (error) throw new Error(error.message);
  const byId = new Map((rows ?? []).map((r) => [r.id, r]));

  let rowsRemoved = 0;
  let filesRemoved = 0;

  // 1. Rows older than the grace period that are missing any of their files.
  for (const r of rows ?? []) {
    if (!old(r.created_at)) continue;
    const { data: files } = await store.list(r.id);
    const have = new Set((files ?? []).map((f) => `${r.id}/${f.name}`));
    if ([r.original_path, r.web_path, r.thumb_path].every((p) => have.has(p))) continue;
    if (have.size) {
      await store.remove([...have]);
      filesRemoved += have.size;
    }
    const del = await admin.from("gallery_photos").delete().eq("id", r.id);
    if (del.error) throw new Error(del.error.message);
    rowsRemoved++;
  }

  // 2. Folders with no row at all.
  for (let offset = 0; ; offset += 1000) {
    const { data: top, error: e } = await store.list("", { limit: 1000, offset });
    if (e) throw new Error(e.message);
    for (const f of top ?? []) {
      if (f.id !== null || byId.has(f.name)) continue; // f.id === null marks a folder
      const { data: files } = await store.list(f.name);
      const stale = (files ?? []).filter((x) => old(x.created_at));
      if (stale.length && stale.length === (files ?? []).length) {
        await store.remove(stale.map((x) => `${f.name}/${x.name}`));
        filesRemoved += stale.length;
      }
    }
    if ((top ?? []).length < 1000) break;
  }

  return { rowsRemoved, filesRemoved };
}
