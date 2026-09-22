"use server";

import { createClient } from "@/lib/supabase/server";
import { parseCycles, isCyclesCsv } from "@/lib/whoop/parse";

export type IngestResult = { ingested: number; error: string | null };

/**
 * Download an uploaded WHOOP export from Storage, parse the physiological_cycles
 * CSV, and upsert the rider's daily rows. Idempotent by (user_id, day).
 */
export async function ingestUpload(uploadId: string): Promise<IngestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ingested: 0, error: "Not signed in." };

  const { data: upload } = await supabase
    .from("uploads")
    .select("id, file_path, user_id")
    .eq("id", uploadId)
    .single();

  const up = upload as { id: string; file_path: string; user_id: string } | null;
  if (!up || up.user_id !== user.id) return { ingested: 0, error: "Upload not found." };

  await supabase.from("uploads").update({ status: "processing" }).eq("id", uploadId);

  const { data: blob, error: dlErr } = await supabase.storage.from("whoop").download(up.file_path);
  if (dlErr || !blob) {
    await supabase.from("uploads").update({ status: "error" }).eq("id", uploadId);
    return { ingested: 0, error: dlErr?.message ?? "Download failed." };
  }

  const text = await blob.text();
  if (!isCyclesCsv(text)) {
    // not the cycles file (e.g. sleeps/workouts) — mark parsed, nothing to ingest
    await supabase.from("uploads").update({ status: "parsed", rows_ingested: 0 }).eq("id", uploadId);
    return { ingested: 0, error: null };
  }

  const days = parseCycles(text);
  if (days.length > 0) {
    const rows = days.map((d) => ({ ...d, user_id: user.id, upload_id: uploadId }));
    const { error: upErr } = await supabase
      .from("whoop_days")
      .upsert(rows, { onConflict: "user_id,day" });
    if (upErr) {
      await supabase.from("uploads").update({ status: "error" }).eq("id", uploadId);
      return { ingested: 0, error: upErr.message };
    }
  }

  await supabase
    .from("uploads")
    .update({ status: "parsed", rows_ingested: days.length })
    .eq("id", uploadId);

  return { ingested: days.length, error: null };
}
