import { Pipe, PipeTransform } from '@angular/core';
import { TrackerType } from '@progress-tracker/contracts';
import { trackerTypeLabel } from '../lib/tracker-display';

@Pipe({ name: 'trackerTypeLabel', standalone: true, pure: true })
export class TrackerTypeLabelPipe implements PipeTransform {
  transform(value: TrackerType | string | null | undefined): string {
    if (value == null || value === '') {
      return '';
    }
    return trackerTypeLabel(value as TrackerType);
  }
}
