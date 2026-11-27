"use client";

import { useCallback, useEffect, useState } from "react";
import type { GalleryPhoto } from "@/app/_data/gallery";
import s from "./gallery.module.css";

const fmt = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Square thumbnails; a click opens the photo full screen with previous / next. */
export function GalleryGrid({ photos }: { photos: GalleryPhoto[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const close = useCallback(() => setOpen(null), []);
  const step = useCallback(
    (d: number) => setOpen((i) => (i == null ? i : (i + d + photos.length) % photos.length)),
    [photos.length]
  );

  useEffect(() => {
    if (open == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, step]);

  const p = open != null ? photos[open] : null;

  return (
    <>
      <ul className={s.grid}>
        {photos.map((ph, i) => (
          <li key={ph.id}>
            <button type="button" className={s.tile} onClick={() => setOpen(i)} aria-label={`Open photo from ${fmt(ph.taken_on)}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URLs, already resized */}
              {ph.thumb && <img src={ph.thumb} alt={ph.caption ?? ""} loading="lazy" />}
            </button>
          </li>
        ))}
      </ul>

      {p && (
        <div className={s.lightbox} role="dialog" aria-modal="true" aria-label="Photo" onClick={close}>
          <div className={s.lbBar} onClick={(e) => e.stopPropagation()}>
            <span>
              {fmt(p.taken_on)}
              {p.uploader ? ` · added by ${p.uploader}` : ""}
            </span>
            <span className={s.lbActions}>
              {p.original && (
                <a href={p.original} download className="btn-ghost">
                  Download
                </a>
              )}
              <button type="button" className="btn-ghost" onClick={close}>
                Close
              </button>
            </span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- signed Storage URL */}
          {p.web && <img className={s.lbImg} src={p.web} alt={p.caption ?? ""} onClick={(e) => e.stopPropagation()} />}
          {p.caption && <p className={s.lbCaption}>{p.caption}</p>}
          {photos.length > 1 && (
            <>
              <button type="button" className={`${s.lbNav} ${s.prev}`} aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); step(-1); }}>←</button>
              <button type="button" className={`${s.lbNav} ${s.next}`} aria-label="Next photo" onClick={(e) => { e.stopPropagation(); step(1); }}>→</button>
            </>
          )}
        </div>
      )}
    </>
  );
}
