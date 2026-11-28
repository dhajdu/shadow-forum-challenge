"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_BYTES = 15 * 1024 * 1024;
const SIZE = 512;

/** Centre-crop to a square and shrink to 512px WebP, so a phone photo uploads fast. */
async function squareWebp(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = SIZE;
  canvas.getContext("2d")!.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("resize"))), "image/webp", 0.86));
}

/** Profile photo: tap the circle, pick a photo, it saves straight away. */
export function AvatarUpload({ userId, url, initials }: { userId: string; url: string | null; initials: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [src, setSrc] = useState(url);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    if (!file.type.startsWith("image/")) return setError("Choose a photo.");
    if (file.size > MAX_BYTES) return setError("That photo is over 15 MB.");
    setBusy(true);
    try {
      const db = createClient();
      const path = `${userId}/${Date.now()}.webp`;
      const up = await db.storage.from("avatars").upload(path, await squareWebp(file), { contentType: "image/webp" });
      if (up.error) throw up.error;
      const publicUrl = db.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const saved = await db.from("profiles").update({ avatar_url: publicUrl }).eq("id", userId);
      if (saved.error) throw saved.error;
      setSrc(publicUrl);
      router.refresh();
    } catch {
      setError("Upload failed. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="avatar-up">
      <button
        type="button"
        className="avatar-xl"
        style={src ? { backgroundImage: `url(${src})` } : undefined}
        onClick={() => input.current?.click()}
        aria-label={src ? "Change your photo" : "Add a photo"}
        disabled={busy}
      >
        {src ? null : initials}
        <span className="avatar-cta">{busy ? "Uploading…" : src ? "Change" : "Add photo"}</span>
      </button>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      {error && <p className="msg err">{error}</p>}
    </div>
  );
}
