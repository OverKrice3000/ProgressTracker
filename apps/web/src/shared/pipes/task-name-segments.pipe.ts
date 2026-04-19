import { Pipe, PipeTransform } from '@angular/core';
import { getHighlightSegments } from '../text-highlight';

@Pipe({ name: 'taskNameSegments', pure: true, standalone: true })
export class TaskNameSegmentsPipe implements PipeTransform {
  transform(name: string, q: string): { text: string; match: boolean }[] {
    return getHighlightSegments(name, q);
  }
}
