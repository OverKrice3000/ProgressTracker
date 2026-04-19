/** Split total minutes into hours and remainder minutes (0–59). */
export function splitMinutesToHoursMinutes(total: number): { hours: number; minutes: number } {
  const t = Math.max(0, Math.floor(total));
  return { hours: Math.floor(t / 60), minutes: t % 60 };
}

/** Combine hours and minutes into total minutes (non-negative). */
export function combineHoursMinutes(hours: number, minutes: number): number {
  const h = Math.max(0, Math.floor(Number(hours) || 0));
  const m = Math.max(0, Math.floor(Number(minutes) || 0));
  return h * 60 + m;
}
