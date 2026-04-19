/** Compact "Xh Ym" for durations (no day component; used in task list targets). */
export function formatHoursMinutesShort(totalMinutes: number): string {
  const safe = Math.max(0, Math.floor(totalMinutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m}m`;
}
