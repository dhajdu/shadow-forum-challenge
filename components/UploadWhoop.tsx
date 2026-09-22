"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ingestUpload } from "@/app/actions/ingest";

type Upload = { id: string; file_name: string; status: string; created_at: string };

export function UploadWhoop({
  userId,
  uploads,
}: {
  userId: string;
  uploads: Upload[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);

    for (const file of Array.from(files)) {
      const path = `${userId}/${Date.now()}_${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("whoop")
        .upload(path, file, { upsert: false });
      if (upErr) {
        setError(upErr.message);
        continue;
      }
      const { data: row, error: rowErr } = await supabase
        .from("uploads")
        .insert({
          user_id: userId,
          file_path: path,
          file_name: file.name,
          status: "uploaded",
        })
        .select("id")
        .single();
      if (rowErr) {
        setError(rowErr.message);
        continue;
      }
      // parse + ingest server-side
      const id = (row as { id: string }).id;
      const res = await ingestUpload(id);
      if (res.error) setError(res.error);
    }

    setBusy(false);
    router.refresh();
  }

  return (
    <div className="upload">
      <label
        className={`drop ${drag ? "drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          accept=".csv,.zip"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
        <b>{busy ? "Uploading…" : "Drop your WHOOP export here"}</b>
        <span>.csv / .zip · or click to browse</span>
      </label>

      {error && <div className="msg err">{error}</div>}

      {uploads.length > 0 && (
        <ul className="filelist">
          {uploads.map((u) => (
            <li key={u.id} className="filerow">
              <span className="fi" />
              <span className="fn">{u.file_name}</span>
              <span className="badge">{u.status}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
