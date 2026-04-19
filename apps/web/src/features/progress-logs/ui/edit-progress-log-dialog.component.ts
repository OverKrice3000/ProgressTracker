import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TrackerType } from '@progress-tracker/contracts';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core/portals/dialog';
import { TaskBase } from '../../../entities/task/model/task.types';
import { ProgressLogsApiService, ProgressLogListItem } from '../model/progress-logs-api.service';
import { TaskTreeRefreshService } from '../../tasks/model/task-tree-refresh.service';
import { TasksApiService } from '../../tasks/model/tasks-api.service';
import { combineHoursMinutes, splitMinutesToHoursMinutes } from '../../tasks/lib/duration-minutes';
import { AppButtonComponent } from '../../../shared/ui/button/app-button.component';
import { formatYmdAsReadable, getLocalDayRangeIso, localNoonIsoForYmd } from '../../../shared/lib/local-day-bounds';

export interface EditProgressLogDialogData {
  log: ProgressLogListItem;
}

@Component({
  selector: 'app-edit-progress-log-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppButtonComponent],
  template: `
    <form *ngIf="task() as currentTask" [formGroup]="logForm" (ngSubmit)="submit(currentTask)" class="grid gap-4">
      <label class="grid gap-2 text-sm" for="edit-log-date">
        <span class="font-medium text-slate-800">Date</span>
        <input
          id="edit-log-date"
          type="date"
          formControlName="logDate"
          [max]="maxLogDateYmd()"
          class="rounded border border-slate-300 p-2"
        />
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
          Progress (counter total after this entry)
          <input
            type="number"
            formControlName="newCurrentNumber"
            min="0"
            class="rounded border border-slate-300 p-2"
          />
        </label>

        <div *ngSwitchCase="trackerType.TIME" class="grid gap-2 text-sm">
          <span class="font-medium text-slate-800">Progress (duration total after this entry)</span>
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
            class="h-4 w-4 shrink-0 rounded border border-slate-300 accent-blue-600 focus:ring-blue-500"
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

      <div class="flex justify-end gap-2">
        <app-button appearance="outline-grayscale" type="button" (click)="cancel()">Cancel</app-button>
        <app-button type="submit" [disabled]="logSubmitDisabled(currentTask)">Save</app-button>
      </div>
    </form>
  `,
})
export class EditProgressLogDialogComponent implements OnInit {
  private readonly tasksApi = inject(TasksApiService);
  private readonly progressLogsApi = inject(ProgressLogsApiService);
  private readonly taskTreeRefresh = inject(TaskTreeRefreshService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<void, EditProgressLogDialogData>;

  readonly trackerType = TrackerType;
  readonly task = signal<TaskBase | null>(null);
  readonly logProgressError = signal<string | null>(null);
  readonly logDailyLine = signal<{ kind: 'info' | 'error'; text: string } | null>(null);
  readonly logDayAlreadyLogged = signal<number | null>(null);
  readonly logDayLoading = signal(false);

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
    const { log } = this.context.data;
    this.tasksApi.getTask(log.taskId).subscribe({
      next: (fresh) => {
        this.task.set(fresh);
        this.patchFormFromLog(fresh, log);
        this.refetchDailyTotal();
      },
      error: () => {
        this.context.completeWith();
      },
    });

    this.logForm.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      const t = this.task();
      if (t && t.trackerType !== TrackerType.SUBTASK) {
        this.recomputeState(t);
      }
    });
    this.logForm
      .get('logDate')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refetchDailyTotal());
  }

  cancel(): void {
    this.context.completeWith();
  }

  maxLogDateYmd(): string {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }

  logSubmitDisabled(task: TaskBase): boolean {
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

  private patchFormFromLog(t: TaskBase, log: ProgressLogListItem): void {
    const applied = (log.appliedTrackerMetadata ?? t.trackerMetadata) as Record<string, unknown>;
    const { hours: tsH, minutes: tsM } = splitMinutesToHoursMinutes(log.timeSpentMinutes);
    const base = { logDate: log.loggedDateYmd, timeSpentHours: tsH, timeSpentMinutes: tsM };
    if (t.trackerType === TrackerType.NUMBER) {
      this.logForm.patchValue({
        ...base,
        newCurrentNumber: Number(applied['current'] ?? 0),
        newCurrentHours: 0,
        newCurrentMinutes: 0,
        markComplete: false,
      });
      return;
    }
    if (t.trackerType === TrackerType.TIME) {
      const curMin = Number(applied['currentMinutes'] ?? 0);
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
        markComplete: Boolean(applied['current']),
      });
    }
  }

  private refetchDailyTotal(): void {
    const task = this.task();
    const log = this.context.data.log;
    if (!task || task.trackerType === TrackerType.SUBTASK) {
      return;
    }
    const ymd = this.logForm.get('logDate')?.value;
    if (!ymd || typeof ymd !== 'string') {
      return;
    }
    this.logDayLoading.set(true);
    this.logDayAlreadyLogged.set(null);
    this.recomputeState(task);
    const { start, end } = getLocalDayRangeIso(ymd);
    this.progressLogsApi.getDailyTotal(start, end, log.id, ymd).subscribe({
      next: (res) => {
        this.logDayAlreadyLogged.set(res.totalMinutes);
        this.logDayLoading.set(false);
        const t = this.task();
        if (t) {
          this.recomputeState(t);
        }
      },
      error: () => {
        this.logDayAlreadyLogged.set(0);
        this.logDayLoading.set(false);
        const t = this.task();
        if (t) {
          this.recomputeState(t);
        }
      },
    });
  }

  private recomputeState(task: TaskBase): void {
    const raw = this.logForm.getRawValue();
    const ymdCheck = raw.logDate;
    if (typeof ymdCheck === 'string' && ymdCheck.length > 0 && ymdCheck > this.maxLogDateYmd()) {
      this.logProgressError.set('Date cannot be in the future.');
      this.logDailyLine.set(null);
      return;
    }
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
    if (trackerErr !== null) {
      this.logDailyLine.set(null);
      return;
    }
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
    if (task.trackerType === TrackerType.NUMBER) {
      const next = Number(raw.newCurrentNumber);
      if (Number.isNaN(next)) {
        return 'Enter a valid number.';
      }
    }
    if (task.trackerType === TrackerType.TIME) {
      const next = combineHoursMinutes(raw.newCurrentHours, raw.newCurrentMinutes);
      if (Number.isNaN(next)) {
        return 'Enter a valid duration.';
      }
    }
    return null;
  }

  submit(task: TaskBase): void {
    if (task.trackerType === TrackerType.SUBTASK) {
      return;
    }
    this.recomputeState(task);
    if (this.logSubmitDisabled(task)) {
      return;
    }
    const raw = this.logForm.getRawValue();
    const ymd = raw.logDate;
    const { start, end } = getLocalDayRangeIso(ymd);
    const timeSpentMinutes = combineHoursMinutes(raw.timeSpentHours, raw.timeSpentMinutes);
    let progressValue: number | boolean = 0;
    if (task.trackerType === TrackerType.NUMBER) {
      progressValue = Number(raw.newCurrentNumber);
    } else if (task.trackerType === TrackerType.TIME) {
      progressValue = combineHoursMinutes(raw.newCurrentHours, raw.newCurrentMinutes);
    } else if (task.trackerType === TrackerType.BOOLEAN) {
      progressValue = raw.markComplete ? 1 : 0;
    }
    const trackerMetadata = this.buildLogMetadata(task, progressValue);
    const { log } = this.context.data;

    this.progressLogsApi
      .updateLog(log.taskId, log.id, {
        timeSpentMinutes,
        trackerMetadata,
        loggedDateYmd: ymd,
        timestamp: localNoonIsoForYmd(ymd),
        dayStartIso: start,
        dayEndIso: end,
        clientTimezoneOffsetMinutes: new Date().getTimezoneOffset(),
      })
      .subscribe({
        next: () => {
          this.taskTreeRefresh.notifyProgressChanged();
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
