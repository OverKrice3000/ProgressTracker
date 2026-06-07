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
