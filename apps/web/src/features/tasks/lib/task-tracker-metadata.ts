import { TrackerType } from '@progress-tracker/contracts';

export function buildTrackerMetadata(type: TrackerType, total: number) {
  if (type === TrackerType.BOOLEAN) {
    return { current: false, total: true };
  }
  if (type === TrackerType.TIME) {
    return { currentMinutes: 0, totalMinutes: total };
  }
  if (type === TrackerType.SUBTASK) {
    return { childIds: [] as string[] };
  }
  return { current: 0, total };
}
