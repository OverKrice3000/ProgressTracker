import { TrackerType } from '@progress-tracker/contracts';
import { TaskBase } from '../model/task.types';

/** True when tracked progress has reached or passed the target (or done flag is set for Simple). */
export function isProgressAtOrAboveTarget(task: TaskBase): boolean {
  const m = task.trackerMetadata as Record<string, unknown>;
  switch (task.trackerType) {
    case TrackerType.NUMBER:
      return Number(m['current'] ?? 0) >= Number(m['total'] ?? 1);
    case TrackerType.TIME:
      return Number(m['currentMinutes'] ?? 0) >= Number(m['totalMinutes'] ?? 1);
    case TrackerType.BOOLEAN:
      return Boolean(m['current']);
    default:
      return false;
  }
}

/** Whether to show a quick “Add progress” control on list rows (trackable, not complete, below target). */
export function showAddProgressOnListRow(task: TaskBase): boolean {
  if (task.trackerType === TrackerType.SUBTASK) {
    return false;
  }
  if (task.isCompleted) {
    return false;
  }
  return !isProgressAtOrAboveTarget(task);
}
