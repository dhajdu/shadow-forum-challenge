"use server";

import { createClient } from "@/lib/supabase/server";
import { ingestUpload as ingest, type IngestResult } from "@/lib/whoop/ingest";

export type { IngestResult };

/** Parse + ingest an upload the signed-in rider just put in Storage. */
export async function ingestUpload(uploadId: string): Promise<IngestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ingested: 0, error: "Not signed in." };
  return ingest(supabase, user.id, uploadId);
}
