import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TrackerType } from '@progress-tracker/contracts';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import { TuiDialogService, type TuiDialogContext } from '@taiga-ui/core/portals/dialog';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { switchMap } from 'rxjs';
import { TaskBase } from '../../../entities/task/model/task.types';
import { ProgressLogsApiService } from '../../progress-logs/model/progress-logs-api.service';
import { TaskTreeRefreshService } from '../model/task-tree-refresh.service';
import { TasksApiService } from '../model/tasks-api.service';
import { TaskTrackingStore } from '../model/task-tracking.store';
import { combineHoursMinutes, splitMinutesToHoursMinutes } from '../lib/duration-minutes';
import { AppButtonComponent } from '../../../shared/ui/button/app-button.component';
import {
  ConfirmActionDialogComponent,
  ConfirmActionDialogData,
} from '../../../shared/ui/modal/confirm-action-dialog.component';
import { formatYmdAsReadable, getLocalDayRangeIso, localNoonIsoForYmd } from '../../../shared/lib/local-day-bounds';

export interface TrackProgressDialogData {
  task: TaskBase;
  prefillElapsedMinutes?: number;
  stopTrackingAfterSave?: boolean;
  onSuccess?: (fresh: TaskBase) => void;
}

@Component({
  selector: 'app-track-progress-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppButtonComponent],
  template: `
    <form *ngIf="task() as currentTask" [formGroup]="logForm" (ngSubmit)="submitLog(currentTask)" class="grid gap-4">
      <label class="grid gap-2 text-sm">
        <span class="font-medium text-slate-800">Date</span>
        <input type="date" formControlName="logDate" class="rounded border border-slate-300 p-2" />
      </label>

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

      <p
        *ngIf="logDailyLine() as line"
        class="text-sm"
        [class.text-rose-600]="line.kind === 'error'"
        [class.text-slate-600]="line.kind === 'info'"
      >
        {{ line.text }}
      </p>
      <p *ngIf="logProgressError()" class="text-sm text-rose-600">{{ logProgressError() }}</p>

      <div class="flex items-center justify-between gap-2">
        <app-button
          *ngIf="activeTrackingTaskId() === currentTask.id"
          appearance="outline-grayscale"
          type="button"
          (click)="confirmStopWithoutLogging(currentTask)"
        >
          Stop without logging
        </app-button>
        <span *ngIf="activeTrackingTaskId() !== currentTask.id"></span>

        <div class="flex gap-2">
          <app-button appearance="outline-grayscale" type="button" (click)="cancel()">Cancel</app-button>
          <app-button type="submit" [disabled]="logSubmitDisabled(currentTask)">Save</app-button>
        </div>
      </div>
    </form>
  `,
})
export class TrackProgressDialogComponent implements OnInit {
  private readonly tasksApi = inject(TasksApiService);
  private readonly progressLogsApi = inject(ProgressLogsApiService);
  private readonly trackingStore = inject(TaskTrackingStore);
  private readonly taskTreeRefresh = inject(TaskTreeRefreshService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialogs = inject(TuiDialogService);
  readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<void, TrackProgressDialogData>;

  readonly trackerType = TrackerType;
  readonly task = signal<TaskBase | null>(null);
  readonly logProgressError = signal<string | null>(null);
  readonly logDailyLine = signal<{ kind: 'info' | 'error'; text: string } | null>(null);
  readonly logDayAlreadyLogged = signal<number | null>(null);
  readonly logDayLoading = signal(false);
  readonly activeTrackingTaskId = computed(() => this.trackingStore.currentSession()?.taskId ?? null);

  private pendingStopTrackingForTaskId: string | null = null;

  readonly logForm = this.fb.nonNullable.group({
    logDate: ['', [Validators.required]],
    timeSpentHours: [0, [Validators.min(0)]],
    timeSpentMinutes: [0, [Validators.min(0), Validators.max(59)]],
    newCurrentNumber: [0],
    newCurrentHours: [0, [Validators.min(0)]],
    newCurrentMinutes: [0, [Validators.min(0), Validators.max(59)]],
    markComplete: [false],
  });

  ngOnInit(): void {
    const d = this.context.data;
    this.tasksApi.getTask(d.task.id).subscribe({
      next: (fresh) => {
        this.task.set(fresh);
        this.pendingStopTrackingForTaskId = d.stopTrackingAfterSave ? fresh.id : null;
        this.patchLogFormFromTask(fresh);
        if (d.prefillElapsedMinutes && d.prefillElapsedMinutes > 0) {
          const pe = d.prefillElapsedMinutes;
          this.logForm.patchValue({
            timeSpentHours: Math.floor(pe / 60),
            timeSpentMinutes: pe % 60,
          });
        }
        this.refetchDailyTotalForLogModal();
      },
      error: () => {
        this.task.set(d.task);
        this.pendingStopTrackingForTaskId = d.stopTrackingAfterSave ? d.task.id : null;
        this.patchLogFormFromTask(d.task);
        if (d.prefillElapsedMinutes && d.prefillElapsedMinutes > 0) {
          const pe = d.prefillElapsedMinutes;
          this.logForm.patchValue({
            timeSpentHours: Math.floor(pe / 60),
            timeSpentMinutes: pe % 60,
          });
        }
        this.refetchDailyTotalForLogModal();
      },
    });

    this.logForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const t = this.task();
      if (t && t.trackerType !== TrackerType.SUBTASK) {
        this.recomputeLogModalState(t);
      }
    });
    this.logForm
      .get('logDate')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const t = this.task();
        if (t && t.trackerType !== TrackerType.SUBTASK && !t.isHidden) {
          this.refetchDailyTotalForLogModal();
        }
      });
  }

  cancel(): void {
    this.pendingStopTrackingForTaskId = null;
    this.context.completeWith();
  }

  logSubmitDisabled(task: TaskBase): boolean {
    if (task.isCompleted) {
      return true;
    }
    if (this.logDayLoading()) {
      return true;
    }
    if (this.logDayAlreadyLogged() === null) {
      return true;
    }
    if (this.logDailyLine()?.kind === 'error') {
      return true;
    }
    return this.logProgressError() !== null;
  }

  confirmStopWithoutLogging(currentTask: TaskBase): void {
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
        this.trackingStore.stopTracking(() => this.context.completeWith());
      });
  }

  private formatElapsedAsHoursMinutes(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }

  private recomputeLogModalState(task: TaskBase): void {
    const raw = this.logForm.getRawValue();
    const timeSpent = combineHoursMinutes(raw.timeSpentHours, raw.timeSpentMinutes);
    let trackerErr: string | null = null;
    if (timeSpent < 1) {
      trackerErr = 'Minimum 1 minute required to log progress.';
    } else if (timeSpent > 1440) {
      trackerErr = 'Time spent cannot exceed 1440 minutes.';
    } else {
      trackerErr = this.computeTrackerValidationError(task, raw);
    }
    this.logProgressError.set(trackerErr);

    const already = this.logDayAlreadyLogged();
    const ymd = raw.logDate;
    if (already === null || !ymd) {
      this.logDailyLine.set(null);
      return;
    }
    const remaining = 1440 - already;
    if (timeSpent > remaining) {
      this.logDailyLine.set({
        kind: 'error',
        text: 'Error: Total time for this day cannot exceed 24 hours.',
      });
      return;
    }
    const label = formatYmdAsReadable(ymd);
    const rh = Math.floor(remaining / 60);
    const rm = remaining % 60;
    this.logDailyLine.set({
      kind: 'info',
      text: `Available for ${label}: ${rh}h ${rm}m remaining.`,
    });
  }

  private computeTrackerValidationError(
    task: TaskBase,
    raw: {
      newCurrentNumber: number;
      newCurrentHours: number;
      newCurrentMinutes: number;
      markComplete: boolean;
    },
  ): string | null {
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

  private todayYmd(): string {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }

  private patchLogFormFromTask(t: TaskBase): void {
    const m = t.trackerMetadata as Record<string, unknown>;
    const { hours: tsH, minutes: tsM } = splitMinutesToHoursMinutes(0);
    const base = { logDate: this.todayYmd(), timeSpentHours: tsH, timeSpentMinutes: tsM };
    if (t.trackerType === TrackerType.NUMBER) {
      const cur = Number(m['current'] ?? 0);
      this.logForm.patchValue({
        ...base,
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
        ...base,
        newCurrentNumber: 0,
        newCurrentHours: nh,
        newCurrentMinutes: nm,
        markComplete: false,
      });
      return;
    }
    if (t.trackerType === TrackerType.BOOLEAN) {
      this.logForm.patchValue({
        ...base,
        newCurrentNumber: 0,
        newCurrentHours: 0,
        newCurrentMinutes: 0,
        markComplete: Boolean(m['current']),
      });
    }
  }

  private refetchDailyTotalForLogModal(): void {
    const task = this.task();
    if (!task || task.trackerType === TrackerType.SUBTASK || task.isHidden) {
      return;
    }
    const ymd = this.logForm.get('logDate')?.value;
    if (!ymd || typeof ymd !== 'string') {
      return;
    }
    this.logDayLoading.set(true);
    this.logDayAlreadyLogged.set(null);
    this.recomputeLogModalState(task);
    const { start, end } = getLocalDayRangeIso(ymd);
    this.progressLogsApi.getDailyTotal(start, end, undefined).subscribe({
      next: (res) => {
        this.logDayAlreadyLogged.set(res.totalMinutes);
        this.logDayLoading.set(false);
        const t = this.task();
        if (t) {
          this.recomputeLogModalState(t);
        }
      },
      error: () => {
        this.logDayAlreadyLogged.set(0);
        this.logDayLoading.set(false);
        const t = this.task();
        if (t) {
          this.recomputeLogModalState(t);
        }
      },
    });
  }

  submitLog(task: TaskBase): void {
    if (task.isHidden || task.isCompleted || task.trackerType === TrackerType.SUBTASK) {
      return;
    }
    this.recomputeLogModalState(task);
    if (this.logSubmitDisabled(task)) {
      return;
    }
    const raw = this.logForm.getRawValue();
    const ymd = raw.logDate;
    const { start, end } = getLocalDayRangeIso(ymd);
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
      .addLog(task.id, {
        timeSpentMinutes,
        trackerMetadata,
        timestamp: localNoonIsoForYmd(ymd),
        dayStartIso: start,
        dayEndIso: end,
      })
      .pipe(switchMap(() => this.tasksApi.getTask(task.id)))
      .subscribe({
        next: (fresh) => {
          this.taskTreeRefresh.notifyProgressChanged();
          this.context.data.onSuccess?.(fresh);
          this.pendingStopTrackingForTaskId = null;
          if (shouldStopTracking && this.trackingStore.currentSession()?.taskId === task.id) {
            this.trackingStore.stopTracking(() => this.context.completeWith());
            return;
          }
          this.context.completeWith();
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
}
