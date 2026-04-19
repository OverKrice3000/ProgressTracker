import { TrackerType } from '@progress-tracker/contracts';

const LABELS: Record<TrackerType, string> = {
  [TrackerType.BOOLEAN]: 'Simple',
  [TrackerType.NUMBER]: 'Counter',
  [TrackerType.TIME]: 'Duration',
  [TrackerType.SUBTASK]: 'Folder',
};

/**
 * Order used when grouping by type (after folders-first): Simple → Counter → Duration → Folder.
 */
export const TRACKER_TYPES_IN_DISPLAY_ORDER: TrackerType[] = [
  TrackerType.BOOLEAN,
  TrackerType.NUMBER,
  TrackerType.TIME,
  TrackerType.SUBTASK,
];

export function trackerTypeLabel(type: TrackerType): string {
  return LABELS[type] ?? String(type);
}

export function compareTrackerTypeForSort(a: TrackerType, b: TrackerType): number {
  return TRACKER_TYPES_IN_DISPLAY_ORDER.indexOf(a) - TRACKER_TYPES_IN_DISPLAY_ORDER.indexOf(b);
}
