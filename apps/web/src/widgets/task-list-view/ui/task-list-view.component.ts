import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { showAddProgressOnListRow } from '../../../entities/task/lib/task-progress-helpers';
import { TaskBase } from '../../../entities/task/model/task.types';
import { TaskAvatarComponent } from '../../../entities/task/ui/task-avatar.component';
import { TaskStatusBadgeComponent } from '../../../entities/task/ui/task-status-badge.component';
import { TrackerTypeLabelPipe } from '../../../entities/task/ui/tracker-type-label.pipe';
import { TaskNameSegmentsPipe } from '../../../shared/pipes/task-name-segments.pipe';

@Component({
  selector: 'app-task-list-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TaskAvatarComponent,
    TaskStatusBadgeComponent,
    TaskNameSegmentsPipe,
    TrackerTypeLabelPipe,
  ],
  template: `
    <ul class="grid gap-3">
      <li
        *ngFor="let task of tasks"
        class="grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
      >
        <app-task-avatar [avatarUrl]="task.avatarUrl" [taskName]="task.name" />

        <div class="min-w-0 space-y-1">
          <a
            [routerLink]="['/task', task.id]"
            class="line-clamp-1 text-sm font-semibold text-slate-900"
          >
            <span *ngFor="let s of (task.name | taskNameSegments:searchQuery)">
              <span [class]="s.match ? 'rounded-sm bg-sky-100/90' : null">{{ s.text }}</span>
            </span>
          </a>
          <p class="truncate text-xs text-slate-500">
            {{ task.trackerType | trackerTypeLabel }}
          </p>
        </div>

        <div class="flex flex-col items-end gap-1">
          <app-task-status-badge [isCompleted]="task.isCompleted" />
          <a
            *ngIf="showAddProgress(task)"
            [routerLink]="['/task', task.id]"
            [queryParams]="{ log: '1' }"
            class="shrink-0 text-xs font-medium text-blue-600 hover:underline"
          >
            Add progress
          </a>
        </div>
      </li>
    </ul>
  `,
})
export class TaskListViewComponent {
  @Input({ required: true }) tasks: TaskBase[] = [];
  @Input() searchQuery = '';

  showAddProgress(task: TaskBase): boolean {
    return showAddProgressOnListRow(task);
  }
}
