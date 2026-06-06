import { TrackerType } from '@progress-tracker/contracts';
import { TaskBase, TaskTreeNode } from '../../entities/task/model/task.types';

export function isEligibleForRandom(task: TaskBase): boolean {
  return !task.isHidden && !task.isCompleted;
}

export function pickRandom<T>(pool: readonly T[]): T | null {
  if (pool.length === 0) {
    return null;
  }
  const idx = Math.floor(Math.random() * pool.length);
  return pool[idx] ?? null;
}

/** Active root tasks (Tasks page — immediate mode). */
export function collectImmediatePoolFromRoots(roots: readonly TaskTreeNode[]): TaskBase[] {
  return roots.filter(isEligibleForRandom);
}

/** Active direct children (task detail — immediate mode). */
export function collectImmediatePoolFromChildren(children: readonly TaskTreeNode[]): TaskBase[] {
  return children.filter(isEligibleForRandom);
}

/** Active non-folder leaves in an entire forest (Tasks page — leaf mode). */
export function collectLeafPoolFromForest(roots: readonly TaskTreeNode[]): TaskBase[] {
  const out: TaskBase[] = [];
  walkForLeaves(roots, out);
  return out;
}

/** Active non-folder leaves under a subtree (task detail — leaf mode). */
export function collectLeafPoolFromSubtree(nodes: readonly TaskTreeNode[]): TaskBase[] {
  const out: TaskBase[] = [];
  walkForLeaves(nodes, out);
  return out;
}

function walkForLeaves(nodes: readonly TaskTreeNode[], out: TaskBase[]): void {
  for (const node of nodes) {
    if (isLeafEligible(node)) {
      out.push(node);
    }
    if (node.children.length > 0) {
      walkForLeaves(node.children, out);
    }
  }
}

function isLeafEligible(node: TaskTreeNode): boolean {
  return (
    isEligibleForRandom(node) &&
    node.trackerType !== TrackerType.SUBTASK &&
    node.children.length === 0
  );
}
