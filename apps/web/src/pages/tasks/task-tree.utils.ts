import { TrackerType } from '@progress-tracker/contracts';
import { compareTrackerTypeForSort } from '../../entities/task/lib/tracker-display';
import { isNodeProgressComplete } from '../../entities/task/lib/task-list-progress';
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

/** Path from a root to `targetId` (inclusive). `null` if the task is not in the tree. */
export function findPathToTask(roots: TaskTreeNode[], targetId: string): TaskTreeNode[] | null {
  for (const n of roots) {
    if (n.id === targetId) {
      return [n];
    }
    const sub = findPathToTask(n.children, targetId);
    if (sub) {
      return [n, ...sub];
    }
  }
  return null;
}

export interface BreadcrumbAncestor {
  id: string;
  name: string;
}

/** When there are more than `maxVisible` ancestors, show first `headKeep` and last `tailKeep` with an ellipsis between. */
export function buildBreadcrumbSegments(
  ancestors: BreadcrumbAncestor[],
  maxVisible = 4,
  headKeep = 2,
  tailKeep = 2,
): { prefix: BreadcrumbAncestor[]; showEllipsis: boolean; suffix: BreadcrumbAncestor[] } {
  if (ancestors.length <= maxVisible) {
    return { prefix: ancestors, showEllipsis: false, suffix: [] };
  }
  return {
    prefix: ancestors.slice(0, headKeep),
    showEllipsis: true,
    suffix: ancestors.slice(-tailKeep),
  };
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

/** In-progress first, then folders, tracker type, name A–Z. Applied recursively. */
function isCompletedForSort(task: TaskBase): boolean {
  if (task.isCompleted) {
    return true;
  }
  const node = task as TaskTreeNode;
  if (node.children !== undefined) {
    return isNodeProgressComplete(node);
  }
  return isNodeProgressComplete(task);
}

function compareCompletionStatus(a: TaskBase, b: TaskBase): number {
  const aCompleted = isCompletedForSort(a) ? 1 : 0;
  const bCompleted = isCompletedForSort(b) ? 1 : 0;
  return aCompleted - bCompleted;
}

function compareSiblings(a: TaskTreeNode, b: TaskTreeNode): number {
  const completion = compareCompletionStatus(a, b);
  if (completion !== 0) {
    return completion;
  }
  const aFolder = a.children.length > 0 ? 1 : 0;
  const bFolder = b.children.length > 0 ? 1 : 0;
  if (aFolder !== bFolder) {
    return bFolder - aFolder;
  }
  const tc = compareTrackerTypeForSort(a.trackerType, b.trackerType);
  if (tc !== 0) {
    return tc;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
}

export function applyDisplaySort(nodes: TaskTreeNode[]): TaskTreeNode[] {
  return [...nodes]
    .sort(compareSiblings)
    .map((n) => ({ ...n, children: applyDisplaySort(n.children) }));
}

export function sortTasksByTypeThenName(tasks: TaskBase[]): TaskBase[] {
  return [...tasks].sort((a, b) => {
    const completion = compareCompletionStatus(a, b);
    if (completion !== 0) {
      return completion;
    }
    const tc = compareTrackerTypeForSort(a.trackerType, b.trackerType);
    if (tc !== 0) {
      return tc;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
  });
}

export interface RecentBucket {
  key: 'today' | 'week' | 'month' | 'older';
  label: string;
  tasks: (TaskBase & { lastTrackedAt: string })[];
}

export const RECENT_BUCKET_DEFS: { key: RecentBucket['key']; label: string }[] = [
  { key: 'today', label: 'tasks.bucketToday' },
  { key: 'week', label: 'tasks.bucketWeek' },
  { key: 'month', label: 'tasks.bucketMonth' },
  { key: 'older', label: 'tasks.bucketOlder' },
];

export type RecentTask = TaskBase & { lastTrackedAt: string };

export interface BuildRecentBucketRowsOptions {
  /** Resolves a parent task when grouping siblings in a bucket. */
  resolveParent?: (parentId: string) => TaskBase | null;
  searchQuery?: string;
}

function recentBucketKeyForTimestamp(lastTrackedAt: string, s0: number, tWeek: number, tMonth: number): RecentBucket['key'] {
  const d = new Date(lastTrackedAt).getTime();
  if (d >= s0) {
    return 'today';
  }
  if (d >= tWeek) {
    return 'week';
  }
  if (d >= tMonth) {
    return 'month';
  }
  return 'older';
}

function taskMatchesSearch(task: TaskBase, q: string): boolean {
  const trimmed = q.trim().toLowerCase();
  if (!trimmed) {
    return true;
  }
  return task.name.toLowerCase().includes(trimmed);
}

function compareTasksForRecentSort(a: TaskBase, b: TaskBase): number {
  const completion = compareCompletionStatus(a, b);
  if (completion !== 0) {
    return completion;
  }
  const tc = compareTrackerTypeForSort(a.trackerType, b.trackerType);
  if (tc !== 0) {
    return tc;
  }
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
}

const PARENT_GROUP_MIN_SIZE = 3;

/**
 * Builds display rows for one time bucket: hides completed leaves, groups siblings by parent.
 * When 3+ siblings (including completed) share a parent, the parent is listed first.
 * Completed siblings are never listed; when 3+ are completed, the parent represents them.
 */
function buildRecentBucketDisplayTasks(
  bucketTasks: RecentTask[],
  resolveParent: (parentId: string) => TaskBase | null,
  searchQuery: string,
): RecentTask[] {
  const byParent = new Map<string, RecentTask[]>();
  const roots: RecentTask[] = [];

  for (const t of bucketTasks) {
    if (!t.parentId) {
      roots.push(t);
      continue;
    }
    const list = byParent.get(t.parentId) ?? [];
    list.push(t);
    byParent.set(t.parentId, list);
  }

  const segments: RecentTask[][] = [];
  const parentIds = [...byParent.keys()].sort((a, b) => {
    const pa = resolveParent(a);
    const pb = resolveParent(b);
    return (pa?.name ?? '').localeCompare(pb?.name ?? '', undefined, { sensitivity: 'base', numeric: true });
  });

  for (const parentId of parentIds) {
    const group = byParent.get(parentId)!;
    const totalCount = group.length;
    const completedCount = group.filter((t) => t.isCompleted).length;
    const showParent = totalCount >= PARENT_GROUP_MIN_SIZE;
    const parent = showParent ? resolveParent(parentId) : null;

    let activeTasks = group.filter((t) => !t.isCompleted);
    if (searchQuery.trim()) {
      const parentMatches = parent ? taskMatchesSearch(parent, searchQuery) : false;
      const anyChildMatches = group.some((t) => taskMatchesSearch(t, searchQuery));
      if (!parentMatches && !anyChildMatches) {
        continue;
      }
      if (!parentMatches) {
        activeTasks = activeTasks.filter((t) => taskMatchesSearch(t, searchQuery));
      }
    }

    const segment: RecentTask[] = [];
    if (
      parent &&
      showParent &&
      (activeTasks.length > 0 || completedCount >= PARENT_GROUP_MIN_SIZE)
    ) {
      const latestInGroup = group.reduce(
        (max, t) => (t.lastTrackedAt > max ? t.lastTrackedAt : max),
        group[0].lastTrackedAt,
      );
      segment.push({ ...parent, lastTrackedAt: latestInGroup });
    }
    if (activeTasks.length > 0) {
      segment.push(...(sortTasksByTypeThenName(activeTasks) as RecentTask[]));
    }
    if (segment.length > 0) {
      segments.push(segment);
    }
  }

  let rootActive = roots.filter((t) => !t.isCompleted);
  if (searchQuery.trim()) {
    rootActive = rootActive.filter((t) => taskMatchesSearch(t, searchQuery));
  }
  for (const root of sortTasksByTypeThenName(rootActive) as RecentTask[]) {
    segments.push([root]);
  }

  segments.sort((a, b) => compareTasksForRecentSort(a[0], b[0]));
  return segments.flat();
}

/**
 * Splits into non-overlapping time buckets; omits empty buckets.
 * Completed leaf tasks are never shown; parent rows may appear when sibling grouping rules apply.
 * Buckets: today, [start-7d, start), [start-30d, start-7d), earlier than start-30d.
 */
export function buildRecentBucketRows(
  tasks: RecentTask[],
  options: BuildRecentBucketRowsOptions = {},
  now: Date = new Date(),
): RecentBucket[] {
  const s0 = startOfLocalDay(now);
  const tWeek = s0 - 7 * MS_PER_DAY;
  const tMonth = s0 - 30 * MS_PER_DAY;
  const map: Record<RecentBucket['key'], RecentTask[]> = {
    today: [],
    week: [],
    month: [],
    older: [],
  };
  for (const t of tasks) {
    const key = recentBucketKeyForTimestamp(t.lastTrackedAt, s0, tWeek, tMonth);
    map[key].push(t);
  }

  const resolveParent = options.resolveParent ?? (() => null);
  const searchQuery = options.searchQuery ?? '';

  return RECENT_BUCKET_DEFS.map((def) => ({
    ...def,
    tasks: buildRecentBucketDisplayTasks(map[def.key], resolveParent, searchQuery),
  })).filter((b) => b.tasks.length > 0);
}

export function filterTasksBySearch(tasks: TaskBase[], q: string): TaskBase[] {
  const trimmed = q.trim().toLowerCase();
  if (!trimmed) {
    return tasks;
  }
  return tasks.filter((t) => taskMatchesSearch(t, q));
}

