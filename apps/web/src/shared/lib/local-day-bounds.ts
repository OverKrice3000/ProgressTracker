/** Local calendar day [start, end) as ISO strings for API queries. */
export function getLocalDayRangeIso(ymd: string): { start: string; end: string } {
  const parts = ymd.split('-').map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  const d = parts[2]!;
  const start = new Date(y, m - 1, d, 0, 0, 0, 0);
  const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Timestamp stored on the log, anchored to local noon on that day (avoids DST edge cases). */
export function localNoonIsoForYmd(ymd: string): string {
  const parts = ymd.split('-').map(Number);
  const y = parts[0]!;
  const mo = parts[1]!;
  const d = parts[2]!;
  return new Date(y, mo - 1, d, 12, 0, 0, 0).toISOString();
}

export function formatYmdAsReadable(ymd: string): string {
  const parts = ymd.split('-').map(Number);
  const dt = new Date(parts[0]!, parts[1]! - 1, parts[2]!);
  return dt.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
