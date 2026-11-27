"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { GALLERY_BUCKET, MAX_PHOTO_BYTES } from "@/app/_data/gallery";
import s from "./gallery.module.css";

type Forum = { id: string; label: string; date: string };
type Item = { name: string; state: "waiting" | "uploading" | "done" | "error"; note?: string };

const WEB_PX = 2048;
const THUMB_PX = 640;

/** Resize in the browser so the gallery loads fast; the original is kept for download. */
async function resized(file: File, max: number): Promise<{ blob: Blob; w: number; h: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
    return blob ? { blob, w: bmp.width, h: bmp.height } : null;
  } catch {
    return null; // e.g. HEIC in a browser that can't decode it
  }
}

async function uploadOne(db: SupabaseClient, file: File, takenOn: string, meetingId: string | null): Promise<string | null> {
  if (file.size > MAX_PHOTO_BYTES) return "Over 15 MB";
  if (!file.type.startsWith("image/")) return "Not an image";
  const [web, thumb] = await Promise.all([resized(file, WEB_PX), resized(file, THUMB_PX)]);
  if (!web || !thumb) return "This browser can't read the file. Try a JPEG, or upload from an iPhone.";

  const id = crypto.randomUUID();
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const paths = { original_path: `${id}/original.${ext}`, web_path: `${id}/web.webp`, thumb_path: `${id}/thumb.webp` };

  const { error: rowErr } = await db.from("gallery_photos").insert({
    id,
    taken_on: takenOn,
    meeting_id: meetingId,
    width: web.w,
    height: web.h,
    bytes: file.size,
    ...paths,
  });
  if (rowErr) return rowErr.message;

  const bucket = db.storage.from(GALLERY_BUCKET);
  const results = await Promise.all([
    bucket.upload(paths.original_path, file, { contentType: file.type }),
    bucket.upload(paths.web_path, web.blob, { contentType: "image/webp" }),
    bucket.upload(paths.thumb_path, thumb.blob, { contentType: "image/webp" }),
  ]);
  const failed = results.find((r) => r.error);
  if (failed) {
    // files first: deleting a file checks its row
    await bucket.remove(Object.values(paths));
    await db.from("gallery_photos").delete().eq("id", id);
    return failed.error!.message;
  }
  return null;
}

export function GalleryUpload({ forums, today }: { forums: Forum[]; today: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [when, setWhen] = useState<string>(forums[0]?.id ?? "date");
  const [date, setDate] = useState(today);
  const [items, setItems] = useState<Item[]>([]);
  const [drag, setDrag] = useState(false);
  const busy = items.some((i) => i.state === "uploading" || i.state === "waiting");

  async function start(files: File[]) {
    if (!files.length || busy) return;
    const forum = forums.find((f) => f.id === when) ?? null;
    const takenOn = forum ? forum.date : date;
    setItems(files.map((f) => ({ name: f.name, state: "waiting" })));
    const db = createClient() as unknown as SupabaseClient;
    // three at a time keeps phones responsive
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        setItems((xs) => xs.map((x, j) => (j === i ? { ...x, state: "uploading" } : x)));
        const err = await uploadOne(db, files[i], takenOn, forum?.id ?? null).catch((e: Error) => e.message);
        setItems((xs) => xs.map((x, j) => (j === i ? { ...x, state: err ? "error" : "done", note: err ?? undefined } : x)));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    router.refresh();
  }

  const done = items.filter((i) => i.state === "done").length;

  return (
    <section className={s.upload}>
      <div className={s.uploadRow}>
        <label className={s.when}>
          <span>Taken at</span>
          <select className="field" value={when} onChange={(e) => setWhen(e.target.value)} disabled={busy}>
            {forums.map((f) => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
            <option value="date">Another day…</option>
          </select>
        </label>
        {when === "date" && (
          <label className={s.when}>
            <span>Date</span>
            <input className="field" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} disabled={busy} />
          </label>
        )}
      </div>

      <div
        className={`${s.drop} ${drag ? s.dragging : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); start(Array.from(e.dataTransfer.files)); }}
      >
        <button type="button" className="btn inline" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? `Uploading ${done} of ${items.length}…` : "Add photos"}
        </button>
        <span className="note-line">or drop them here · up to 15 MB each, as many as you like</span>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => { start(Array.from(e.target.files ?? [])); e.target.value = ""; }}
        />
      </div>

      {items.length > 0 && (
        <ul className={s.progress}>
          {items.map((it, i) => (
            <li key={i} className={s[it.state]}>
              <span>{it.name}</span>
              <span>{it.state === "error" ? it.note : it.state === "done" ? "Added" : it.state === "uploading" ? "Uploading…" : "Waiting"}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
