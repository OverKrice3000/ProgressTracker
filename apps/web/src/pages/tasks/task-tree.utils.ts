import { TrackerType } from '@progress-tracker/contracts';
import { compareTrackerTypeForSort } from '../../entities/task/lib/tracker-display';
import { TaskBase, TaskTreeNode } from '../../entities/task/model/task.types';

/** Returns the first node in the task tree (depth-first) whose id matches. */
export function findNodeInTree(roots: TaskTreeNode[], id: string): TaskTreeNode | null {
  for (const n of roots) {
    if (n.id === id) {
      return n;
    }
    const found = findNodeInTree(n.children, id);
    if (found) {
      return found;
    }
  }
  return null;
}

export function filterTreeByCompletionAndTracker(
  node: TaskTreeNode,
  completion: 'all' | 'active' | 'completed',
  tracker: TrackerType | '',
): TaskTreeNode | null {
  const matchesTracker = !tracker || node.trackerType === tracker;
  const matchesCompletion =
    completion === 'all' ||
    (completion === 'active' && !node.isCompleted) ||
    (completion === 'completed' && node.isCompleted);

  const childrenFiltered = node.children
    .map((c) => filterTreeByCompletionAndTracker(c, completion, tracker))
    .filter((c): c is TaskTreeNode => c !== null);

  if (node.children.length > 0) {
    if (childrenFiltered.length > 0) {
      return { ...node, children: childrenFiltered };
    }
    return matchesTracker && matchesCompletion ? { ...node, children: [] } : null;
  }

  return matchesTracker && matchesCompletion ? node : null;
}

export function filterTreeBySearch(nodes: TaskTreeNode[], q: string): TaskTreeNode[] {
  const trimmed = q.trim();
  if (!trimmed) {
    return nodes;
  }
  const lower = trimmed.toLowerCase();
  return nodes
    .map((node) => {
      const nameMatch = node.name.toLowerCase().includes(lower);
      const childFiltered = filterTreeBySearch(node.children, q);
      if (nameMatch) {
        return { ...node, children: node.children };
      }
      if (childFiltered.length > 0) {
        return { ...node, children: childFiltered };
      }
      return null;
    })
    .filter((n): n is TaskTreeNode => n !== null);
}

const MS_PER_DAY = 86_400_000;

export function startOfLocalDay(d: Date): number {
  const t = new Date(d);
  t.setHours(0, 0, 0, 0);
  return t.getTime();
}

/** Folders (non-empty children) first, then tracker type, then name A–Z. Applied recursively. */
function compareSiblings(a: TaskTreeNode, b: TaskTreeNode): number {
  const aFolder = a.children.length > 0 ? 1 : 0;
  const bFolder = b.children.length > 0 ? 1 : 0;
  if (aFolder !== bFolder) {
    return bFolder - aFolder;
  }
  const tc = compareTrackerTypeForSort(a.trackerType, b.trackerType);
  if (tc !== 0) {
    return tc;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
}

export function applyDisplaySort(nodes: TaskTreeNode[]): TaskTreeNode[] {
  return [...nodes]
    .sort(compareSiblings)
    .map((n) => ({ ...n, children: applyDisplaySort(n.children) }));
}

export function sortTasksByTypeThenName(tasks: TaskBase[]): TaskBase[] {
  return [...tasks].sort((a, b) => {
    const tc = compareTrackerTypeForSort(a.trackerType, b.trackerType);
    if (tc !== 0) {
      return tc;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

export interface RecentBucket {
  key: 'today' | 'week' | 'month' | 'older';
  label: string;
  tasks: (TaskBase & { lastTrackedAt: string })[];
}

export const RECENT_BUCKET_DEFS: { key: RecentBucket['key']; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'In the last week' },
  { key: 'month', label: 'In the last month' },
  { key: 'older', label: 'More than a month ago' },
];

/**
 * Splits into non-overlapping time buckets; omits empty buckets. Sorts each bucket: type then name.
 * Buckets: today, [start-7d, start), [start-30d, start-7d), earlier than start-30d.
 */
export function buildRecentBucketRows(
  tasks: (TaskBase & { lastTrackedAt: string })[],
  now: Date = new Date(),
): RecentBucket[] {
  const s0 = startOfLocalDay(now);
  const tWeek = s0 - 7 * MS_PER_DAY;
  const tMonth = s0 - 30 * MS_PER_DAY;
  type T = TaskBase & { lastTrackedAt: string };
  const map: Record<RecentBucket['key'], T[]> = {
    today: [],
    week: [],
    month: [],
    older: [],
  };
  for (const t of tasks) {
    const d = new Date(t.lastTrackedAt).getTime();
    if (d >= s0) {
      map.today.push(t);
    } else if (d < s0 && d >= tWeek) {
      map.week.push(t);
    } else if (d < tWeek && d >= tMonth) {
      map.month.push(t);
    } else {
      map.older.push(t);
    }
  }
  (['today', 'week', 'month', 'older'] as const).forEach((k) => {
    map[k] = sortTasksByTypeThenName(map[k]) as T[];
  });
  return RECENT_BUCKET_DEFS.map((def) => ({ ...def, tasks: map[def.key] })).filter((b) => b.tasks.length > 0);
}

export function filterTasksBySearch(tasks: TaskBase[], q: string): TaskBase[] {
  const trimmed = q.trim().toLowerCase();
  if (!trimmed) {
    return tasks;
  }
  return tasks.filter((t) => t.name.toLowerCase().includes(trimmed));
}

