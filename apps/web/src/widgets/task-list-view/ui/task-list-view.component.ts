import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TrackerType } from '@progress-tracker/contracts';
import { showAddProgressOnListRow } from '../../../entities/task/lib/task-progress-helpers';
import { TaskBase } from '../../../entities/task/model/task.types';
import { TaskAvatarComponent } from '../../../entities/task/ui/task-avatar.component';
import { TaskActionsMenuComponent } from '../../../entities/task/ui/task-actions-menu.component';
import { TaskStatusBadgeComponent } from '../../../entities/task/ui/task-status-badge.component';
import { TrackerTypeLabelPipe } from '../../../entities/task/ui/tracker-type-label.pipe';
import { TaskNameSegmentsPipe } from '../../../shared/pipes/task-name-segments.pipe';
import { TaskProgressBarUi, getFlatListProgressBarUi } from '../../../entities/task/lib/task-list-progress';

@Component({
  selector: 'app-task-list-view',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TaskAvatarComponent,
    TaskActionsMenuComponent,
    TaskStatusBadgeComponent,
    TaskNameSegmentsPipe,
    TrackerTypeLabelPipe,
  ],
  template: `
    <ul class="grid gap-3">
      <li
        *ngFor="let task of tasks"
        class="grid grid-cols-[auto,1fr,auto,auto] items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
        [class.opacity-60]="task.isHidden"
      >
        <app-task-avatar [avatarUrl]="task.avatarUrl" [taskName]="task.name" />

        <div class="min-w-0 space-y-1">
          <div class="flex items-center gap-2">
            <a
              [routerLink]="['/task', task.id]"
              class="line-clamp-1 text-sm font-semibold text-slate-900"
            >
              <span *ngFor="let s of (task.name | taskNameSegments:searchQuery)">
                <span [class]="s.match ? 'rounded-sm bg-sky-100/90' : null">{{ s.text }}</span>
              </span>
            </a>
            <span
              *ngIf="task.isHidden"
              class="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
            >
              Archived
            </span>
            <span
              *ngIf="activeTrackingTaskId === task.id"
              class="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
            >
              Tracking
            </span>
          </div>
          <p class="truncate text-xs text-slate-500">
            {{ task.trackerType | trackerTypeLabel }}
          </p>
          <ng-container *ngIf="progressUi(task) as ui">
            <p class="text-xs font-medium text-slate-700">{{ ui.label }}</p>
            <div class="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-slate-200">
              <div
                class="h-full rounded-full transition-[width] duration-300"
                [class.bg-emerald-500]="ui.done"
                [class.bg-sky-600]="!ui.done"
                [style.width.%]="ui.ratio * 100"
              ></div>
            </div>
          </ng-container>
        </div>

        <div class="flex min-h-8 flex-col items-end justify-center gap-1">
          <app-task-status-badge [isCompleted]="task.isCompleted" />
        </div>

        <div class="self-center justify-self-end">
          <app-task-actions-menu
            [canLogProgress]="showAddProgress(task)"
            [showEditOption]="!task.isHidden"
            [showLogProgressOption]="!task.isHidden && task.trackerType !== trackerType.SUBTASK && !task.isCompleted"
            [showTrackingOption]="!task.isHidden && task.trackerType !== trackerType.SUBTASK && !task.isCompleted"
            [isTrackingActive]="activeTrackingTaskId === task.id"
            [showDeleteOption]="!task.isHidden"
            [showRestoreOption]="task.isHidden"
            (editTask)="editTask.emit(task)"
            (logProgress)="logProgress.emit(task)"
            (toggleTracking)="toggleTracking.emit(task)"
            (deleteTask)="deleteTask.emit(task)"
            (restoreTask)="restoreTask.emit(task)"
          />
        </div>
      </li>
    </ul>
  `,
})
export class TaskListViewComponent {
  readonly trackerType = TrackerType;

  @Input({ required: true }) tasks: TaskBase[] = [];
  @Input() searchQuery = '';
  @Input() activeTrackingTaskId: string | null = null;
  @Output() editTask = new EventEmitter<TaskBase>();
  @Output() logProgress = new EventEmitter<TaskBase>();
  @Output() toggleTracking = new EventEmitter<TaskBase>();
  @Output() deleteTask = new EventEmitter<TaskBase>();
  @Output() restoreTask = new EventEmitter<TaskBase>();

  showAddProgress(task: TaskBase): boolean {
    return showAddProgressOnListRow(task);
  }

  progressUi(task: TaskBase): TaskProgressBarUi | null {
    return getFlatListProgressBarUi(task);
  }
}
