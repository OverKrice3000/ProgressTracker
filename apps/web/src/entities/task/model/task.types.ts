import { TrackerType } from '@progress-tracker/contracts';

export interface TaskBase {
  id: string;
  userId: string;
  parentId: string | null;
  depth: number;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  isCompleted: boolean;
  trackerType: TrackerType;
  trackerMetadata: Record<string, unknown>;
}

export interface TaskTreeNode extends TaskBase {
  children: TaskTreeNode[];
}

export interface ProgressLogInput {
  timeSpentMinutes: number;
  trackerMetadata: Record<string, unknown>;
}

export interface TaskFilters {
  rootOnly: boolean;
  isCompleted?: boolean;
  trackerType?: TrackerType;
  sortBy: 'name' | 'trackerType' | 'depth';
  sortOrder: 'asc' | 'desc';
}
