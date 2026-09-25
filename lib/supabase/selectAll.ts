// Supabase caps each select at 1000 rows. Page through with .range() so big
// tables (every rider's WHOOP history) come back complete. The query must have
// a deterministic .order() for paging to be stable.
const PAGE = 1000;

export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}
