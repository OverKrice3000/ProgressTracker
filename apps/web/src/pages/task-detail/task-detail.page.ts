import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, TemplateRef, ViewChild, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TrackerType } from '@progress-tracker/contracts';
import { TuiDialogService } from '@taiga-ui/core/portals/dialog';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { distinctUntilChanged, filter, map, switchMap } from 'rxjs';
import { showAddProgressOnListRow } from '../../entities/task/lib/task-progress-helpers';
import { TaskBase, TaskTreeNode } from '../../entities/task/model/task.types';
import { TasksApiService } from '../../features/tasks/model/tasks-api.service';
import { TaskTrackingStore } from '../../features/tasks/model/task-tracking.store';
import {
  CreateTaskDialogComponent,
  CreateTaskDialogData,
} from '../../features/tasks/ui/create-task-dialog.component';
import { combineHoursMinutes, splitMinutesToHoursMinutes } from '../../features/tasks/lib/duration-minutes';
import { AppButtonComponent } from '../../shared/ui/button/app-button.component';
import { TaskStatusBadgeComponent } from '../../entities/task/ui/task-status-badge.component';
import { TaskActionsMenuComponent } from '../../entities/task/ui/task-actions-menu.component';
import { TrackerTypeLabelPipe } from '../../entities/task/ui/tracker-type-label.pipe';
import {
  EditTaskDialogComponent,
  EditTaskDialogData,
} from '../../features/tasks/ui/edit-task-dialog.component';
import {
  ConfirmActionDialogComponent,
  ConfirmActionDialogData,
} from '../../shared/ui/modal/confirm-action-dialog.component';
import { TaskHierarchyViewComponent } from '../../widgets/task-hierarchy-view/ui/task-hierarchy-view.component';
import { applyDisplaySort, findNodeInTree } from '../tasks/task-tree.utils';

@Component({
  selector: 'app-task-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppButtonComponent,
    TaskStatusBadgeComponent,
    TaskActionsMenuComponent,
    TaskHierarchyViewComponent,
    TrackerTypeLabelPipe,
  ],
  template: `
    <section class="mx-auto flex w-full max-w-3xl flex-col gap-6 p-4" *ngIf="task() as currentTask">
      <div class="space-y-3 rounded-2xl bg-white p-6 shadow-sm">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-2">
            <h1 class="text-2xl font-semibold">{{ currentTask.name }}</h1>
            <span
              *ngIf="activeTrackingTaskId() === currentTask.id"
              class="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
            >
              Tracking
            </span>
          </div>
          <div class="flex items-center gap-2">
            <app-button appearance="outline-grayscale" size="s" (click)="openEditModal(currentTask)">
              Edit task
            </app-button>
            <app-task-actions-menu
              [canLogProgress]="showAddProgressButton(currentTask)"
              [showLogProgressOption]="currentTask.trackerType !== trackerType.SUBTASK && !currentTask.isCompleted"
              [showTrackingOption]="currentTask.trackerType !== trackerType.SUBTASK && !currentTask.isCompleted"
              [isTrackingActive]="activeTrackingTaskId() === currentTask.id"
              (editTask)="openEditModal(currentTask)"
              (logProgress)="openLogModal()"
              (toggleTracking)="toggleTracking(currentTask)"
            />
          </div>
        </div>
        <p class="text-sm text-slate-600">{{ currentTask.description }}</p>
        <p class="text-xs text-slate-500">Type: {{ currentTask.trackerType | trackerTypeLabel }}</p>
        <app-task-status-badge
          *ngIf="currentTask.trackerType !== trackerType.SUBTASK"
          [isCompleted]="currentTask.isCompleted"
        />
      </div>

      <ng-container [ngSwitch]="currentTask.trackerType">
        <p *ngSwitchCase="trackerType.NUMBER" class="text-sm text-slate-700">
          Progress: {{ currentTask.trackerMetadata['current'] }} / {{ currentTask.trackerMetadata['total'] }}
        </p>
        <p *ngSwitchCase="trackerType.TIME" class="text-sm text-slate-700">
          Time: {{ currentTask.trackerMetadata['currentMinutes'] }} / {{ currentTask.trackerMetadata['totalMinutes'] }} minutes
        </p>
        <ng-container *ngSwitchCase="trackerType.BOOLEAN" />
        <ng-container *ngSwitchCase="trackerType.SUBTASK" />
      </ng-container>

      <div class="flex flex-wrap gap-3">
        <app-button
          *ngIf="currentTask.trackerType === trackerType.SUBTASK"
          (click)="openCreateChildModal()"
          [disabled]="currentTask.isCompleted"
        >
          Create child
        </app-button>
        <app-button
          *ngIf="showAddProgressButton(currentTask)"
          (click)="openLogModal()"
        >
          Add progress log
        </app-button>
        <app-button
          *ngIf="currentTask.trackerType !== trackerType.SUBTASK && !currentTask.isCompleted"
          [appearance]="activeTrackingTaskId() === currentTask.id ? 'outline-grayscale' : 'primary'"
          (click)="toggleTracking(currentTask)"
        >
          {{ activeTrackingTaskId() === currentTask.id ? 'Stop tracking' : 'Start tracking' }}
        </app-button>
      </div>

      <div class="space-y-3" *ngIf="subtaskTree().length > 0">
        <h2 class="text-lg font-semibold text-slate-900">Subtasks</h2>
        <app-task-hierarchy-view
          [nodes]="subtaskTree()"
          [searchQuery]="''"
          [expandedFolderIds]="subtaskExpandedFolderIds()"
          [activeTrackingTaskId]="activeTrackingTaskId()"
          (folderExpandToggle)="toggleSubtaskFolder($event)"
          (editTask)="openEditModal($event)"
          (logProgress)="openTaskLog($event)"
          (toggleTracking)="toggleTracking($event)"
        />
      </div>

      <ng-template #logDialog let-completeWith="completeWith">
        <form [formGroup]="logForm" (ngSubmit)="submitLog(currentTask, completeWith)" class="grid gap-4">
          <div class="grid gap-2 text-sm">
            <span class="font-medium text-slate-800">Time spent (this session)</span>
            <div class="grid grid-cols-2 gap-3">
              <label class="grid gap-1">
                Hours
                <input
                  type="number"
                  formControlName="timeSpentHours"
                  min="0"
                  class="rounded border border-slate-300 p-2"
                />
              </label>
              <label class="grid gap-1">
                Minutes
                <input
                  type="number"
                  formControlName="timeSpentMinutes"
                  min="0"
                  max="59"
                  class="rounded border border-slate-300 p-2"
                />
              </label>
            </div>
          </div>

          <ng-container [ngSwitch]="currentTask.trackerType">
            <label *ngSwitchCase="trackerType.NUMBER" class="grid gap-2 text-sm">
              New progress (counter)
              <input
                type="number"
                formControlName="newCurrentNumber"
                min="0"
                class="rounded border border-slate-300 p-2"
              />
            </label>

            <div *ngSwitchCase="trackerType.TIME" class="grid gap-2 text-sm">
              <span class="font-medium text-slate-800">New progress (duration)</span>
              <div class="grid grid-cols-2 gap-3">
                <label class="grid gap-1">
                  Hours
                  <input
                    type="number"
                    formControlName="newCurrentHours"
                    min="0"
                    class="rounded border border-slate-300 p-2"
                  />
                </label>
                <label class="grid gap-1">
                  Minutes
                  <input
                    type="number"
                    formControlName="newCurrentMinutes"
                    min="0"
                    max="59"
                    class="rounded border border-slate-300 p-2"
                  />
                </label>
              </div>
            </div>

            <label
              *ngSwitchCase="trackerType.BOOLEAN"
              class="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3"
            >
              <input
                type="checkbox"
                formControlName="markComplete"
                class="h-4 w-4 shrink-0 rounded border-slate-300 accent-blue-600 focus:ring-blue-500"
              />
              <span class="text-sm font-medium text-slate-800">Complete</span>
            </label>
          </ng-container>

          <p *ngIf="logProgressError()" class="text-sm text-rose-600">{{ logProgressError() }}</p>

          <div class="flex items-center justify-between gap-2">
            <app-button
              *ngIf="activeTrackingTaskId() === currentTask.id"
              appearance="outline-grayscale"
              type="button"
              (click)="confirmStopWithoutLogging(completeWith, currentTask)"
            >
              Stop without logging
            </app-button>
            <span *ngIf="activeTrackingTaskId() !== currentTask.id"></span>

            <div class="flex gap-2">
              <app-button appearance="outline-grayscale" type="button" (click)="completeWith()">
                Cancel
              </app-button>
              <app-button type="submit" [disabled]="logSubmitDisabled(currentTask)">Save</app-button>
            </div>
          </div>
        </form>
      </ng-template>
    </section>
  `,
})
export class TaskDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tasksApi = inject(TasksApiService);
  private readonly trackingStore = inject(TaskTrackingStore);
  private readonly fb = inject(FormBuilder);
  private readonly dialogs = inject(TuiDialogService);
  @ViewChild('logDialog') private logDialog?: TemplateRef<unknown>;

  readonly trackerType = TrackerType;
  readonly task = signal<TaskBase | null>(null);
  /** Nested subtasks of the current task, from the project tree (supports folder expansion). */
  readonly subtaskTree = signal<TaskTreeNode[]>([]);
  /** Expanded folder ids in the subtasks list (same behavior as the Tasks page hierarchy). */
  readonly subtaskExpandedFolderIds = signal<Set<string>>(new Set());
  readonly logProgressError = signal<string | null>(null);
  readonly activeTrackingTaskId = computed(() => this.trackingStore.currentSession()?.taskId ?? null);
  private pendingStopTrackingForTaskId: string | null = null;

  readonly logForm = this.fb.nonNullable.group({
    timeSpentHours: [0, [Validators.min(0)]],
    timeSpentMinutes: [0, [Validators.min(0), Validators.max(59)]],
    newCurrentNumber: [0],
    newCurrentHours: [0, [Validators.min(0)]],
    newCurrentMinutes: [0, [Validators.min(0), Validators.max(59)]],
    markComplete: [false],
  });

  ngOnInit(): void {
    this.trackingStore.loadCurrent();
    this.logForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const t = this.task();
      if (t && t.trackerType !== TrackerType.SUBTASK) {
        this.logProgressError.set(this.computeProgressValidationError(t));
      }
    });
    this.route.paramMap
      .pipe(
        map((params) => params.get('id')),
        filter((id): id is string => id !== null && id.length > 0),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((taskId) => {
        this.task.set(null);
        this.subtaskTree.set([]);
        this.subtaskExpandedFolderIds.set(new Set());
        this.logForm.reset({
          timeSpentHours: 0,
          timeSpentMinutes: 0,
          newCurrentNumber: 0,
          newCurrentHours: 0,
          newCurrentMinutes: 0,
          markComplete: false,
        });
        this.logProgressError.set(null);
        this.loadTask(taskId);
        this.loadSubtaskTree(taskId);
      });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      if (!this.task()) {
        return;
      }
      this.handleLogQueryIfPresent();
    });
  }

  toggleSubtaskFolder(taskId: string): void {
    this.subtaskExpandedFolderIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  showAddProgressButton(task: TaskBase): boolean {
    return showAddProgressOnListRow(task);
  }

  logSubmitDisabled(task: TaskBase): boolean {
    if (task.isCompleted) {
      return true;
    }
    return this.computeProgressValidationError(task) !== null;
  }

  private computeProgressValidationError(task: TaskBase): string | null {
    const raw = this.logForm.getRawValue();
    const timeSpent = combineHoursMinutes(raw.timeSpentHours, raw.timeSpentMinutes);
    if (timeSpent < 1) {
      return 'Minimum 1 minute required to log progress.';
    }
    if (timeSpent > 1440) {
      return 'Time spent cannot exceed 1440 minutes.';
    }
    const m = task.trackerMetadata as Record<string, unknown>;
    if (task.trackerType === TrackerType.NUMBER) {
      const next = Number(raw.newCurrentNumber);
      if (Number.isNaN(next)) {
        return 'Enter a valid number.';
      }
      const prev = Number(m['current'] ?? 0);
      if (next < prev) {
        return 'New value cannot be lower than current.';
      }
    }
    if (task.trackerType === TrackerType.TIME) {
      const next = combineHoursMinutes(raw.newCurrentHours, raw.newCurrentMinutes);
      if (Number.isNaN(next)) {
        return 'Enter a valid duration.';
      }
      const prev = Number(m['currentMinutes'] ?? 0);
      if (next < prev) {
        return 'New value cannot be lower than current.';
      }
    }
    if (task.trackerType === TrackerType.BOOLEAN) {
      const prev = Boolean(m['current']);
      const next = raw.markComplete;
      if (prev && !next) {
        return 'New value cannot be lower than current.';
      }
    }
    return null;
  }

  openCreateChildModal(): void {
    const t = this.task();
    if (!t || t.trackerType !== TrackerType.SUBTASK || t.isCompleted) {
      return;
    }
    const data: CreateTaskDialogData = {
      parent: t,
      onSuccess: () => {
        this.loadTask(t.id);
        this.loadSubtaskTree(t.id);
      },
    };
    this.dialogs.open(new PolymorpheusComponent(CreateTaskDialogComponent), {
      label: 'Create task',
      data,
    }).subscribe();
  }

  openEditModal(task: TaskBase): void {
    const data: EditTaskDialogData = {
      task,
      onSuccess: () => {
        const currentId = this.route.snapshot.paramMap.get('id');
        if (!currentId) {
          return;
        }
        this.loadTask(currentId);
        this.loadSubtaskTree(currentId);
      },
    };
    this.dialogs.open(new PolymorpheusComponent(EditTaskDialogComponent), {
      label: 'Edit task',
      data,
    }).subscribe();
  }

  openTaskLog(task: TaskBase): void {
    void this.router.navigate(['/task', task.id], { queryParams: { log: '1' } });
  }

  toggleTracking(task: TaskBase): void {
    const current = this.trackingStore.currentSession();
    if (current?.taskId === task.id) {
      this.openLogModal(this.trackingStore.elapsedMinutes(), true);
      return;
    }
    if (!current) {
      const data: ConfirmActionDialogData = {
        message: 'Start tracking this task?',
        confirmLabel: 'Start',
      };
      this.dialogs
        .open<boolean>(new PolymorpheusComponent(ConfirmActionDialogComponent), {
          label: 'Start tracking',
          data,
        })
        .subscribe((ok) => {
          if (ok) {
            this.trackingStore.startTracking(task.id);
          }
        });
      return;
    }
    const data: ConfirmActionDialogData = {
      message: `You are already tracking ${current.taskName}. Stop it and start this one?`,
      confirmLabel: 'Switch',
    };
    this.dialogs
      .open<boolean>(new PolymorpheusComponent(ConfirmActionDialogComponent), {
        label: 'Switch tracking',
        data,
      })
      .subscribe((ok) => {
        if (ok) {
          this.trackingStore.startTracking(task.id, true);
        }
      });
  }

  openLogModal(prefillElapsedMinutes?: number, stopTrackingAfterSave = false): void {
    const t = this.task();
    if (!this.logDialog || !t || t.trackerType === TrackerType.SUBTASK) {
      return;
    }
    this.pendingStopTrackingForTaskId = stopTrackingAfterSave ? t.id : null;
    this.patchLogFormFromTask(t);
    if (prefillElapsedMinutes && prefillElapsedMinutes > 0) {
      this.logForm.patchValue({
        timeSpentHours: Math.floor(prefillElapsedMinutes / 60),
        timeSpentMinutes: prefillElapsedMinutes % 60,
      });
    }
    this.logProgressError.set(this.computeProgressValidationError(t));
    this.dialogs.open(this.logDialog, { label: 'Track progress' }).subscribe(() => {
      this.pendingStopTrackingForTaskId = null;
    });
  }

  confirmStopWithoutLogging(
    completeWith: (value?: unknown) => void,
    currentTask: TaskBase,
  ): void {
    const active = this.trackingStore.currentSession();
    if (!active || active.taskId !== currentTask.id) {
      return;
    }
    const elapsed = this.trackingStore.elapsedMinutes();
    const data: ConfirmActionDialogData = {
      message: `Are you sure you want to stop tracking? This session's time (${this.formatElapsedAsHoursMinutes(elapsed)}) will be discarded and not saved to your progress.`,
      confirmLabel: 'Stop and discard',
      cancelLabel: 'Keep tracking',
    };
    this.dialogs
      .open<boolean>(new PolymorpheusComponent(ConfirmActionDialogComponent), {
        label: 'Discard tracked time?',
        data,
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.pendingStopTrackingForTaskId = null;
        this.trackingStore.stopTracking(() => completeWith());
      });
  }

  private formatElapsedAsHoursMinutes(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }

  private patchLogFormFromTask(t: TaskBase): void {
    const m = t.trackerMetadata as Record<string, unknown>;
    const { hours: tsH, minutes: tsM } = splitMinutesToHoursMinutes(0);
    if (t.trackerType === TrackerType.NUMBER) {
      const cur = Number(m['current'] ?? 0);
      this.logForm.patchValue({
        timeSpentHours: tsH,
        timeSpentMinutes: tsM,
        newCurrentNumber: cur,
        newCurrentHours: 0,
        newCurrentMinutes: 0,
        markComplete: false,
      });
      return;
    }
    if (t.trackerType === TrackerType.TIME) {
      const curMin = Number(m['currentMinutes'] ?? 0);
      const { hours: nh, minutes: nm } = splitMinutesToHoursMinutes(curMin);
      this.logForm.patchValue({
        timeSpentHours: tsH,
        timeSpentMinutes: tsM,
        newCurrentNumber: 0,
        newCurrentHours: nh,
        newCurrentMinutes: nm,
        markComplete: false,
      });
      return;
    }
    if (t.trackerType === TrackerType.BOOLEAN) {
      this.logForm.patchValue({
        timeSpentHours: tsH,
        timeSpentMinutes: tsM,
        newCurrentNumber: 0,
        newCurrentHours: 0,
        newCurrentMinutes: 0,
        markComplete: Boolean(m['current']),
      });
    }
  }

  submitLog(task: TaskBase, completeWith: (value?: unknown) => void): void {
    if (task.isCompleted || task.trackerType === TrackerType.SUBTASK) {
      return;
    }
    const err = this.computeProgressValidationError(task);
    if (err !== null) {
      this.logProgressError.set(err);
      return;
    }
    const raw = this.logForm.getRawValue();
    const shouldStopTracking = this.pendingStopTrackingForTaskId === task.id;
    const timeSpentMinutes = shouldStopTracking
      ? this.trackingStore.elapsedMinutes()
      : combineHoursMinutes(raw.timeSpentHours, raw.timeSpentMinutes);
    let progressValue: number | boolean = 0;
    if (task.trackerType === TrackerType.NUMBER) {
      progressValue = Number(raw.newCurrentNumber);
    } else if (task.trackerType === TrackerType.TIME) {
      progressValue = combineHoursMinutes(raw.newCurrentHours, raw.newCurrentMinutes);
    } else if (task.trackerType === TrackerType.BOOLEAN) {
      progressValue = raw.markComplete ? 1 : 0;
    }
    const trackerMetadata = this.buildLogMetadata(task, progressValue);

    this.tasksApi
      .addLog(task.id, { timeSpentMinutes, trackerMetadata })
      .pipe(switchMap(() => this.tasksApi.getTask(task.id)))
      .subscribe({
        next: (fresh) => {
          this.task.set(fresh);
          this.pendingStopTrackingForTaskId = null;
          if (shouldStopTracking && this.trackingStore.currentSession()?.taskId === task.id) {
            this.trackingStore.stopTracking(() => completeWith());
            return;
          }
          completeWith();
        },
      });
  }

  private buildLogMetadata(task: TaskBase, progressValue: number | boolean): Record<string, unknown> {
    if (task.trackerType === TrackerType.BOOLEAN) {
      return {
        ...(task.trackerMetadata as Record<string, unknown>),
        current: progressValue === true || progressValue === 1,
      };
    }
    if (task.trackerType === TrackerType.TIME) {
      return {
        ...(task.trackerMetadata as Record<string, unknown>),
        currentMinutes: progressValue as number,
      };
    }
    if (task.trackerType === TrackerType.SUBTASK) {
      return task.trackerMetadata as Record<string, unknown>;
    }
    return {
      ...(task.trackerMetadata as Record<string, unknown>),
      current: progressValue as number,
    };
  }

  private loadTask(taskId: string): void {
    this.tasksApi.getTask(taskId).subscribe((task) => {
      this.task.set(task);
      queueMicrotask(() => this.handleLogQueryIfPresent());
    });
  }

  private handleLogQueryIfPresent(): void {
    const currentTask = this.task();
    if (!currentTask || this.route.snapshot.queryParamMap.get('log') !== '1') {
      return;
    }
    const elapsed = Number(this.route.snapshot.queryParamMap.get('elapsed') ?? 0);
    const shouldStopTracking = this.route.snapshot.queryParamMap.get('stopTracking') === '1';
    this.openLogModal(Number.isFinite(elapsed) && elapsed > 0 ? elapsed : undefined, shouldStopTracking);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { log: null, elapsed: null, stopTracking: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private loadSubtaskTree(taskId: string): void {
    this.tasksApi.getTree().subscribe((roots) => {
      const self = findNodeInTree(roots, taskId);
      this.subtaskTree.set(self ? applyDisplaySort(self.children) : []);
    });
  }
}
