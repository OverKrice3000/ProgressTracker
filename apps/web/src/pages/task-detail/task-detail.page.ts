import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TrackerType } from '@progress-tracker/contracts';
import { TuiDialogService } from '@taiga-ui/core/portals/dialog';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { distinctUntilChanged, filter, map } from 'rxjs';
import { showAddProgressOnListRow } from '../../entities/task/lib/task-progress-helpers';
import { TaskBase, TaskTreeNode } from '../../entities/task/model/task.types';
import { TasksApiService } from '../../features/tasks/model/tasks-api.service';
import { TaskTrackingStore } from '../../features/tasks/model/task-tracking.store';
import {
  CreateTaskDialogComponent,
  CreateTaskDialogData,
} from '../../features/tasks/ui/create-task-dialog.component';
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
import { TrackProgressDialogComponent } from '../../features/tasks/ui/track-progress-dialog.component';
import { TaskHierarchyViewComponent } from '../../widgets/task-hierarchy-view/ui/task-hierarchy-view.component';
import { formatHoursMinutesShort } from '../../shared/lib/format-hours-minutes';
import { applyDisplaySort, findNodeInTree } from '../tasks/task-tree.utils';

@Component({
  selector: 'app-task-detail-page',
  standalone: true,
  imports: [
    CommonModule,
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
              *ngIf="currentTask.isHidden"
              class="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700"
            >
              Archived
            </span>
            <span
              *ngIf="!currentTask.isHidden && activeTrackingTaskId() === currentTask.id"
              class="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700"
            >
              Tracking
            </span>
          </div>
          <div class="flex items-center gap-2" *ngIf="!currentTask.isHidden">
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
              (deleteTask)="confirmDeleteTask(currentTask)"
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
          Time: {{ formatDurationMinutesForDisplay(currentTask.trackerMetadata['currentMinutes']) }} / {{ formatDurationMinutesForDisplay(currentTask.trackerMetadata['totalMinutes']) }}
        </p>
        <ng-container *ngSwitchCase="trackerType.BOOLEAN" />
        <ng-container *ngSwitchCase="trackerType.SUBTASK" />
      </ng-container>

      <div class="flex flex-wrap gap-3">
        <app-button
          *ngIf="!currentTask.isHidden && currentTask.trackerType === trackerType.SUBTASK"
          (click)="openCreateChildModal()"
          [disabled]="currentTask.isCompleted"
        >
          Create child
        </app-button>
        <app-button
          *ngIf="!currentTask.isHidden && showAddProgressButton(currentTask)"
          (click)="openLogModal()"
        >
          Add progress log
        </app-button>
        <app-button
          *ngIf="!currentTask.isHidden && currentTask.trackerType !== trackerType.SUBTASK && !currentTask.isCompleted"
          [appearance]="activeTrackingTaskId() === currentTask.id ? 'outline-grayscale' : 'primary'"
          (click)="toggleTracking(currentTask)"
        >
          {{ activeTrackingTaskId() === currentTask.id ? 'Stop tracking' : 'Start tracking' }}
        </app-button>
        <app-button
          *ngIf="!currentTask.isHidden"
          appearance="outline-grayscale"
          (click)="confirmDeleteTask(currentTask)"
        >
          Delete
        </app-button>
        <app-button *ngIf="currentTask.isHidden" appearance="outline-grayscale" (click)="restoreTask(currentTask)">
          Restore task
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
          (deleteTask)="confirmDeleteTask($event)"
        />
      </div>
    </section>
  `,
})
export class TaskDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tasksApi = inject(TasksApiService);
  private readonly trackingStore = inject(TaskTrackingStore);
  private readonly dialogs = inject(TuiDialogService);

  readonly trackerType = TrackerType;
  readonly task = signal<TaskBase | null>(null);
  /** Nested subtasks of the current task, from the project tree (supports folder expansion). */
  readonly subtaskTree = signal<TaskTreeNode[]>([]);
  /** Expanded folder ids in the subtasks list (same behavior as the Tasks page hierarchy). */
  readonly subtaskExpandedFolderIds = signal<Set<string>>(new Set());
  readonly activeTrackingTaskId = computed(() => this.trackingStore.currentSession()?.taskId ?? null);

  ngOnInit(): void {
    this.trackingStore.loadCurrent();
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

  /** TIME tracker summary line; matches task list / stats "Xh Ym" formatting. */
  formatDurationMinutesForDisplay(minutes: unknown): string {
    const n = Number(minutes);
    return formatHoursMinutesShort(Number.isFinite(n) ? n : 0);
  }

  openCreateChildModal(): void {
    const t = this.task();
    if (!t || t.isHidden || t.trackerType !== TrackerType.SUBTASK || t.isCompleted) {
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
    if (task.isHidden) {
      return;
    }
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
    if (task.isHidden || task.trackerType === TrackerType.SUBTASK) {
      return;
    }
    const parentId = this.route.snapshot.paramMap.get('id');
    this.dialogs.open(new PolymorpheusComponent(TrackProgressDialogComponent), {
      label: 'Track progress',
      data: {
        task,
        onSuccess: () => {
          if (parentId) {
            this.loadSubtaskTree(parentId);
          }
        },
      },
    }).subscribe();
  }

  toggleTracking(task: TaskBase): void {
    if (task.isHidden) {
      return;
    }
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
    if (!t || t.isHidden || t.trackerType === TrackerType.SUBTASK) {
      return;
    }
    this.dialogs.open(new PolymorpheusComponent(TrackProgressDialogComponent), {
      label: 'Track progress',
      data: {
        task: t,
        prefillElapsedMinutes,
        stopTrackingAfterSave,
        onSuccess: (fresh: TaskBase) => {
          this.task.set(fresh);
          this.loadSubtaskTree(fresh.id);
        },
      },
    }).subscribe();
  }

  confirmDeleteTask(task: TaskBase): void {
    const data: ConfirmActionDialogData = {
      message:
        'Are you sure you want to delete this task? Tasks with tracked progress will be archived to keep your statistics accurate.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
    };
    this.dialogs
      .open<boolean>(new PolymorpheusComponent(ConfirmActionDialogComponent), {
        label: 'Delete task?',
        data,
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.tasksApi.delete(task.id).subscribe(() => {
          const isStillVisible = !task.isHidden;
          if (this.activeTrackingTaskId() === task.id) {
            this.trackingStore.loadCurrent();
          }
          if (isStillVisible) {
            void this.router.navigate(['/tasks']);
            return;
          }
          this.loadTask(task.id);
          this.loadSubtaskTree(task.id);
        });
      });
  }

  restoreTask(task: TaskBase): void {
    if (!task.isHidden) {
      return;
    }
    this.tasksApi.restore(task.id).subscribe((restored) => {
      this.task.set(restored);
      this.loadSubtaskTree(restored.id);
    });
  }

  private loadTask(taskId: string): void {
    this.tasksApi.getTask(taskId).subscribe((task) => {
      this.task.set(task);
      queueMicrotask(() => this.handleLogQueryIfPresent());
    });
  }

  private handleLogQueryIfPresent(): void {
    const currentTask = this.task();
    if (!currentTask || currentTask.isHidden || this.route.snapshot.queryParamMap.get('log') !== '1') {
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
    const includeHidden = this.task()?.isHidden ?? false;
    this.tasksApi.getTree(includeHidden).subscribe((roots) => {
      const self = findNodeInTree(roots, taskId);
      this.subtaskTree.set(self ? applyDisplaySort(self.children) : []);
    });
  }
}
