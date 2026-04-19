/** Formats logged minutes as Xd Xh Xm (24h per day); omits zero parts except 0m when total is 0. */
export function formatDurationMinutes(totalMinutes: number): string {
  if (totalMinutes <= 0) {
    return '0m';
  }
  const dayMin = 24 * 60;
  const d = Math.floor(totalMinutes / dayMin);
  const rem = totalMinutes % dayMin;
  const h = Math.floor(rem / 60);
  const m = rem % 60;
  const parts: string[] = [];
  if (d > 0) {
    parts.push(`${d}d`);
  }
  if (h > 0) {
    parts.push(`${h}h`);
  }
  if (m > 0 || parts.length === 0) {
    parts.push(`${m}m`);
  }
  return parts.join(' ');
}
