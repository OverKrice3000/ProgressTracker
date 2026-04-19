import { TrackerType } from '@progress-tracker/contracts';
import { TaskTreeNode } from '../../entities/task/model/task.types';
import { statsColorHexForTaskId } from '../../shared/lib/stats-task-colors';

export const STATS_UNTRACKED_ID = '__untracked__';

export function rolledUpMinutes(node: TaskTreeNode, byTask: Map<string, number>): number {
  const self = byTask.get(node.id) ?? 0;
  return self + node.children.reduce((sum, c) => sum + rolledUpMinutes(c, byTask), 0);
}

/** Drops any subtree whose rolled-up time is 0; also drops children with 0m individually. */
export function filterStatsTreeByPositiveTime(
  nodes: TaskTreeNode[],
  byTask: Map<string, number>,
): TaskTreeNode[] {
  const result: TaskTreeNode[] = [];
  for (const node of nodes) {
    const total = rolledUpMinutes(node, byTask);
    if (total <= 0) {
      continue;
    }
    const filteredChildren = filterStatsTreeByPositiveTime(node.children, byTask);
    result.push({ ...node, children: filteredChildren });
  }
  return result;
}

export function buildMinutesMap(
  summaryByTask: { taskId: string; minutes: number }[],
): Map<string, number> {
  return new Map(summaryByTask.map((r) => [r.taskId, r.minutes]));
}

export interface StatsPieSlice {
  taskId: string;
  taskName: string;
  minutes: number;
  /** True when this slice is a collapsed folder (SUBTASK with children) — chart treats as interactive. */
  isExpandableFolder: boolean;
}

/** Sort siblings by rolled-up time descending (stats view). */
function sortStatsSiblings(nodes: TaskTreeNode[], byTask: Map<string, number>): TaskTreeNode[] {
  return [...nodes].sort(
    (a, b) => rolledUpMinutes(b, byTask) - rolledUpMinutes(a, byTask),
  );
}

export function buildVisiblePieSlices(
  nodes: TaskTreeNode[],
  expanded: Set<string>,
  byTask: Map<string, number>,
): StatsPieSlice[] {
  const sorted = sortStatsSiblings(nodes, byTask);
  const out: StatsPieSlice[] = [];
  sorted.forEach((node) => {
    const minutes = rolledUpMinutes(node, byTask);
    const expandable =
      node.trackerType === TrackerType.SUBTASK && node.children.length > 0;

    if (expandable && expanded.has(node.id)) {
      out.push(...buildVisiblePieSlices(node.children, expanded, byTask));
    } else {
      out.push({
        taskId: node.id,
        taskName: node.name,
        minutes,
        isExpandableFolder: expandable,
      });
    }
  });
  return out;
}

export interface StatsTableRow {
  taskId: string;
  name: string;
  minutes: number;
  depth: number;
  isExpandable: boolean;
  isExpanded: boolean;
  /** Matches the pie slice fill for this task (or Untracked). */
  sliceColor: string;
  /** Dot hidden for expanded folders (slice is split); shown for leaves and collapsed folders. */
  showSliceColor: boolean;
}

/** Maps each taskId to the same hex used for the pie slice and table dot (deterministic per id). */
export function buildTaskSliceColorMap(slices: StatsPieSlice[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const sl of slices) {
    map.set(sl.taskId, statsColorHexForTaskId(sl.taskId));
  }
  return map;
}

export function buildStatsTableRows(
  nodes: TaskTreeNode[],
  expanded: Set<string>,
  byTask: Map<string, number>,
  sliceColors: Map<string, string>,
  depth = 0,
): StatsTableRow[] {
  const sorted = sortStatsSiblings(nodes, byTask);
  const rows: StatsTableRow[] = [];
  for (const node of sorted) {
    const minutes = rolledUpMinutes(node, byTask);
    const expandable =
      node.trackerType === TrackerType.SUBTASK && node.children.length > 0;
    const isExpanded = expandable && expanded.has(node.id);
    const sliceColor = sliceColors.get(node.id) ?? '#cbd5e1';
    const showSliceColor = !expandable || !isExpanded;
    rows.push({
      taskId: node.id,
      name: node.name,
      minutes,
      depth,
      isExpandable: expandable,
      isExpanded,
      sliceColor,
      showSliceColor,
    });
    if (isExpanded) {
      rows.push(
        ...buildStatsTableRows(node.children, expanded, byTask, sliceColors, depth + 1),
      );
    }
  }
  return rows;
}
