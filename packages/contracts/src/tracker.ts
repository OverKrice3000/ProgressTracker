export enum TrackerType {
  BOOLEAN = "BOOLEAN",
  NUMBER = "NUMBER",
  TIME = "TIME",
  SUBTASK = "SUBTASK",
}

export interface BooleanTrackerMetadata {
  current: boolean;
  total: boolean;
}

export interface NumberTrackerMetadata {
  current: number;
  total: number;
  unit?: string;
}

export interface TimeTrackerMetadata {
  currentMinutes: number;
  totalMinutes: number;
}

export interface SubtaskTrackerMetadata {
  childIds: string[];
}

export interface BaseTracker<TType extends TrackerType, TMetadata> {
  trackerType: TType;
  trackerMetadata: TMetadata;
}

export type BooleanTracker = BaseTracker<
  TrackerType.BOOLEAN,
  BooleanTrackerMetadata
>;
export type NumberTracker = BaseTracker<TrackerType.NUMBER, NumberTrackerMetadata>;
export type TimeTracker = BaseTracker<TrackerType.TIME, TimeTrackerMetadata>;
export type SubtaskTracker = BaseTracker<
  TrackerType.SUBTASK,
  SubtaskTrackerMetadata
>;

export type TaskTracker =
  | BooleanTracker
  | NumberTracker
  | TimeTracker
  | SubtaskTracker;

export interface TaskSnapshot {
  taskName: string;
  trackerType: TrackerType;
}

export interface ProgressLogSnapshot extends TaskSnapshot {
  trackerMetadata: TaskTracker["trackerMetadata"];
}
