// Text embeddings for agenda search (meeting_chunks.embedding is vector(1024)).
// Voyage AI voyage-3.5 returns 1024 dimensions by default.
export const EMBED_DIMS = 1024;
const MODEL = "voyage-3.5";

export function embeddingsConfigured(): boolean {
  return !!process.env.VOYAGE_API_KEY;
}

/** Embed texts. `query` for a search question, `document` for agenda chunks. */
export async function embed(texts: string[], inputType: "query" | "document"): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY not set");
  if (texts.length === 0) return [];

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, input: texts, input_type: inputType, output_dimension: EMBED_DIMS }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}`);
  const body = (await res.json()) as { data: { index: number; embedding: number[] }[] };
  const out = body.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
  if (out.length !== texts.length || out.some((v) => v.length !== EMBED_DIMS)) throw new Error("embeddings: bad shape");
  return out;
}

/** pgvector text form, for inserts and RPC arguments. */
export const toVector = (v: number[]) => `[${v.join(",")}]`;
