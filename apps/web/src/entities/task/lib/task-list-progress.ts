import { TrackerType } from '@progress-tracker/contracts';
import { TaskBase, TaskTreeNode } from '../model/task.types';
import { formatHoursMinutesShort } from '../../../shared/lib/format-hours-minutes';

export interface TaskProgressBarUi {
  label: string;
  /** 0..1 */
  ratio: number;
  /** True when bar should use success (green) fill */
  done: boolean;
}

type ProgressNode = Pick<TaskBase, 'trackerType' | 'trackerMetadata' | 'isCompleted'> & {
  children?: TaskTreeNode[];
};

/** Recursive: leaf targets met, or folder with all descendants satisfying rules. Empty folder → not complete. */
export function isNodeProgressComplete(node: ProgressNode): boolean {
  if (node.trackerType === TrackerType.SUBTASK) {
    const children = node.children ?? [];
    if (children.length === 0) {
      return false;
    }
    return children.every((c) => isNodeProgressComplete(c));
  }
  if (node.trackerType === TrackerType.NUMBER) {
    const m = node.trackerMetadata as Record<string, unknown>;
    const cur = Number(m['current'] ?? 0);
    const tot = Number(m['total'] ?? 1);
    return cur >= tot;
  }
  if (node.trackerType === TrackerType.TIME) {
    const m = node.trackerMetadata as Record<string, unknown>;
    const cur = Number(m['currentMinutes'] ?? 0);
    const tot = Number(m['totalMinutes'] ?? 1);
    return cur >= tot;
  }
  if (node.trackerType === TrackerType.BOOLEAN) {
    const m = node.trackerMetadata as Record<string, unknown>;
    return Boolean(m['current']);
  }
  return false;
}

/** Folder: direct children only; ratio = completedChildren / totalChildren. No children → null (no UI). */
export function getFolderProgressBarUi(node: TaskTreeNode): TaskProgressBarUi | null {
  if (node.trackerType !== TrackerType.SUBTASK) {
    return null;
  }
  const children = node.children ?? [];
  if (children.length === 0) {
    return null;
  }
  const completed = children.filter((c) => isNodeProgressComplete(c)).length;
  const total = children.length;
  const ratio = total > 0 ? completed / total : 0;
  const done = ratio >= 1 - 1e-9 || node.isCompleted;
  return {
    label: `${completed} / ${total}`,
    ratio: Math.min(1, Math.max(0, ratio)),
    done,
  };
}

export function getQuantityProgressBarUi(node: ProgressNode): TaskProgressBarUi | null {
  if (node.trackerType !== TrackerType.NUMBER) {
    return null;
  }
  const m = node.trackerMetadata as Record<string, unknown>;
  const cur = Number(m['current'] ?? 0);
  const tot = Number(m['total'] ?? 1);
  const unit = String(m['unit'] ?? '').trim();
  const unitSuffix = unit ? ` ${unit}` : '';
  const ratio = tot > 0 ? Math.min(1, cur / tot) : 0;
  const done = (tot > 0 && cur >= tot) || node.isCompleted;
  return {
    label: `${cur} / ${tot}${unitSuffix}`,
    ratio,
    done,
  };
}

export function getDurationProgressBarUi(node: ProgressNode): TaskProgressBarUi | null {
  if (node.trackerType !== TrackerType.TIME) {
    return null;
  }
  const m = node.trackerMetadata as Record<string, unknown>;
  const cur = Number(m['currentMinutes'] ?? 0);
  const tot = Number(m['totalMinutes'] ?? 1);
  const ratio = tot > 0 ? Math.min(1, cur / tot) : 0;
  const done = (tot > 0 && cur >= tot) || node.isCompleted;
  return {
    label: `${formatHoursMinutesShort(cur)} / ${formatHoursMinutesShort(tot)}`,
    ratio,
    done,
  };
}

/** Hierarchy rows: folder (non-empty), counter, or duration. */
export function getHierarchyProgressBarUi(node: TaskTreeNode): TaskProgressBarUi | null {
  const folder = getFolderProgressBarUi(node);
  if (folder) {
    return folder;
  }
  const q = getQuantityProgressBarUi(node);
  if (q) {
    return q;
  }
  return getDurationProgressBarUi(node);
}

/** Flat list (e.g. Recent): only counter / duration — no folder tree. */
export function getFlatListProgressBarUi(task: TaskBase): TaskProgressBarUi | null {
  const q = getQuantityProgressBarUi(task);
  if (q) {
    return q;
  }
  return getDurationProgressBarUi(task);
}
