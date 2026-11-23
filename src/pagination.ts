export interface Pagination { limit: number; offset: number }

export function pagination(params: URLSearchParams): Pagination | null {
  const read = (name: string, fallback: number, min: number, max: number): number | null => {
    const values = params.getAll(name);
    if (!values.length) return fallback;
    if (values.length !== 1 || !/^[0-9]+$/.test(values[0])) return null;
    const value = Number(values[0]);
    return Number.isSafeInteger(value) && value >= min && value <= max ? value : null;
  };
  const limit = read('limit', 100, 1, 100);
  const offset = read('offset', 0, 0, Number.MAX_SAFE_INTEGER - 100);
  return limit === null || offset === null ? null : {limit, offset};
}

export async function readPage(db: D1Database, select: string, count: string, order: string,
                               values: string[], page: Pagination, note?: string) {
  // D1 batches give the count and rows one consistent transaction snapshot.
  const [countResult, rowsResult] = await db.batch<Record<string, unknown>>([
    db.prepare(count).bind(...values),
    db.prepare(select + order + ' LIMIT ? OFFSET ?').bind(...values, page.limit, page.offset)
  ]);
  const total = Number(countResult.results?.[0]?.total ?? 0);
  const results = rowsResult.results ?? [];
  const hasMore = page.offset + results.length < total;
  return {results, count: results.length, total,
    pagination: {...page, has_more: hasMore, next_offset: hasMore ? page.offset + page.limit : null},
    ...(note ? {note} : {})};
}
