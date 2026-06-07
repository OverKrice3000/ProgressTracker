import { inject, Pipe, PipeTransform } from '@angular/core';
import { TrackerType } from '@progress-tracker/contracts';
import { TranslocoService } from '@jsverse/transloco';

const TRACKER_KEY_MAP: Partial<Record<TrackerType, string>> = {
  [TrackerType.BOOLEAN]: 'createTask.trackerSimple',
  [TrackerType.NUMBER]: 'createTask.trackerCounter',
  [TrackerType.TIME]: 'createTask.trackerDuration',
  [TrackerType.SUBTASK]: 'createTask.trackerFolder',
};

@Pipe({ name: 'trackerTypeLabel', standalone: true, pure: false })
export class TrackerTypeLabelPipe implements PipeTransform {
  private readonly transloco = inject(TranslocoService);

  transform(value: TrackerType | string | null | undefined): string {
    if (value == null || value === '') {
      return '';
    }
    const key = TRACKER_KEY_MAP[value as TrackerType];
    return key ? this.transloco.translate(key) : String(value);
  }
}
