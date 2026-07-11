// Supabase/PostgREST silently caps a single select at 1000 rows. Tables that have
// grown past that (csi_records already has) return incomplete data unless the query
// is paged. This walks the query in chunks until a short page signals the end.
//
// The caller's query MUST have a stable, deterministic order (e.g. .order('id') as a
// final tie-breaker) — otherwise rows can repeat or go missing across page boundaries.
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data } = await page(from, from + pageSize - 1)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < pageSize) break
  }
  return all
}
