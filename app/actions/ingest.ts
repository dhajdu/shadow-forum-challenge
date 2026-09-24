"use server";

import { unzipSync, strFromU8 } from "fflate";
import { createClient } from "@/lib/supabase/server";
import { parseCycles, isCyclesCsv, parseJournal, isJournalCsv } from "@/lib/whoop/parse";

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

  // Get the physiological_cycles and journal_entries CSV text — the file may be a
  // raw CSV or a WHOOP export .zip containing several CSVs.
  const buf = new Uint8Array(await blob.arrayBuffer());
  const looksZip = up.file_path.toLowerCase().endsWith(".zip") || (buf[0] === 0x50 && buf[1] === 0x4b);

  let text: string | null = null;
  let journalText: string | null = null;
  const pick = (t: string) => {
    if (!text && isCyclesCsv(t)) text = t;
    else if (!journalText && isJournalCsv(t)) journalText = t;
  };
  if (looksZip) {
    try {
      const files = unzipSync(buf);
      for (const [name, data] of Object.entries(files)) {
        if (name.toLowerCase().endsWith(".csv")) pick(strFromU8(data));
      }
    } catch {
      await supabase.from("uploads").update({ status: "error" }).eq("id", uploadId);
      return { ingested: 0, error: "Could not read the .zip file." };
    }
  } else {
    pick(strFromU8(buf));
  }

  const days = text ? parseCycles(text) : [];
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

  const journal = journalText ? parseJournal(journalText) : [];
  if (journal.length > 0) {
    const rows = journal.map((j) => ({ ...j, user_id: user.id, upload_id: uploadId }));
    const { error: jErr } = await supabase
      .from("whoop_journal")
      .upsert(rows, { onConflict: "user_id,day,question" });
    if (jErr) {
      await supabase.from("uploads").update({ status: "error" }).eq("id", uploadId);
      return { ingested: 0, error: jErr.message };
    }
  }

  await supabase
    .from("uploads")
    .update({ status: "parsed", rows_ingested: days.length })
    .eq("id", uploadId);

  return { ingested: days.length, error: null };
}
