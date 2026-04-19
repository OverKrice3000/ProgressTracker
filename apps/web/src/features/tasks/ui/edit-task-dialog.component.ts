import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TrackerType } from '@progress-tracker/contracts';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core/portals/dialog';
import { TaskBase } from '../../../entities/task/model/task.types';
import { AppButtonComponent } from '../../../shared/ui/button/app-button.component';
import { TasksApiService } from '../model/tasks-api.service';
import { combineHoursMinutes, splitMinutesToHoursMinutes } from '../lib/duration-minutes';

export interface EditTaskDialogData {
  task: TaskBase;
  onSuccess: () => void;
}

@Component({
  selector: 'app-edit-task-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppButtonComponent],
  template: `
    <form [formGroup]="editForm" (ngSubmit)="submit()" class="grid gap-4">
      <label class="grid gap-2 text-sm" for="edit-task-name">
        Name
        <input
          id="edit-task-name"
          type="text"
          formControlName="name"
          autocomplete="off"
          class="w-full rounded border border-slate-300 p-2"
        />
      </label>

      <label class="grid gap-2 text-sm">
        Description
        <textarea formControlName="description" class="min-h-20 rounded border border-slate-300 p-2"></textarea>
      </label>

      <label *ngIf="isCounterType()" class="grid gap-2 text-sm" for="edit-task-target">
        Target
        <input
          id="edit-task-target"
          type="number"
          formControlName="targetTotal"
          [attr.min]="counterTargetMin"
          class="w-full rounded border border-slate-300 p-2"
        />
      </label>

      <div *ngIf="isDurationType()" class="grid gap-2 text-sm">
        <span class="font-medium text-slate-800">Target Duration</span>
        <div class="grid grid-cols-2 gap-3">
          <label class="grid gap-1">
            Hours
            <input
              type="number"
              formControlName="durationHours"
              min="0"
              class="w-full rounded border border-slate-300 p-2"
            />
          </label>
          <label class="grid gap-1">
            Minutes
            <input
              type="number"
              formControlName="durationMinutes"
              min="0"
              max="59"
              class="w-full rounded border border-slate-300 p-2"
            />
          </label>
        </div>
      </div>

      <p *ngIf="targetError()" class="text-xs text-rose-600" role="alert">{{ targetError() }}</p>

      <div class="flex justify-end gap-2">
        <app-button appearance="outline-grayscale" type="button" (click)="cancel()">Cancel</app-button>
        <app-button type="submit">Save</app-button>
      </div>
    </form>
  `,
})
export class EditTaskDialogComponent implements OnInit {
  private readonly tasksApi = inject(TasksApiService);
  private readonly fb = inject(FormBuilder);
  readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<void, EditTaskDialogData>;

  readonly task = this.context.data.task;

  readonly numberCurrent = Math.max(0, Math.floor(Number(this.taskMeta['current'] ?? 0)));
  readonly timeCurrentMinutes = Math.max(0, Math.floor(Number(this.taskMeta['currentMinutes'] ?? 0)));

  readonly targetError = signal<string | null>(null);

  private get taskMeta(): Record<string, unknown> {
    return this.task.trackerMetadata as Record<string, unknown>;
  }

  readonly editForm = (() => {
    const m = this.taskMeta;
    const storedTotal = Math.floor(Number(m['total'] ?? 1));
    const storedTotalMin = Math.floor(Number(m['totalMinutes'] ?? 1));
    const dur = splitMinutesToHoursMinutes(
      Math.max(this.timeCurrentMinutes, Math.max(1, storedTotalMin)),
    );
    return this.fb.nonNullable.group({
      name: [this.task.name, Validators.required],
      description: [this.task.description ?? ''],
      targetTotal: [Math.max(Math.max(1, this.numberCurrent), storedTotal)],
      durationHours: [dur.hours],
      durationMinutes: [dur.minutes],
    });
  })();

  ngOnInit(): void {
    if (this.task.trackerType === TrackerType.NUMBER) {
      const min = Math.max(1, this.numberCurrent);
      this.editForm.controls.targetTotal.setValidators([Validators.required, Validators.min(min)]);
      this.editForm.controls.targetTotal.updateValueAndValidity();
    }
    if (this.task.trackerType === TrackerType.TIME) {
      this.editForm.controls.durationHours.setValidators([Validators.min(0)]);
      this.editForm.controls.durationMinutes.setValidators([Validators.min(0), Validators.max(59)]);
      this.editForm.controls.durationHours.updateValueAndValidity();
      this.editForm.controls.durationMinutes.updateValueAndValidity();
    }
  }

  isCounterType(): boolean {
    return this.task.trackerType === TrackerType.NUMBER;
  }

  isDurationType(): boolean {
    return this.task.trackerType === TrackerType.TIME;
  }

  get counterTargetMin(): number {
    return Math.max(1, this.numberCurrent);
  }

  cancel(): void {
    this.context.completeWith();
  }

  submit(): void {
    this.targetError.set(null);
    if (this.editForm.invalid) {
      this.editForm.controls.name.markAsTouched();
      if (this.isCounterType()) {
        this.editForm.controls.targetTotal.markAsTouched();
      }
      return;
    }
    const raw = this.editForm.getRawValue();
    const name = raw.name.trim();
    const description = raw.description.trim();

    if (this.task.trackerType === TrackerType.NUMBER) {
      const t = Math.floor(Number(raw.targetTotal));
      if (t < this.numberCurrent) {
        this.targetError.set('Target cannot be lower than current progress.');
        return;
      }
      if (t < 1) {
        return;
      }
      this.tasksApi
        .update(this.task.id, {
          name,
          description,
          trackerMetadata: { total: t },
        })
        .subscribe({
          next: () => this.finishSuccess(),
          error: (err: unknown) => this.setHttpError(err),
        });
      return;
    }

    if (this.task.trackerType === TrackerType.TIME) {
      const totalMin = combineHoursMinutes(raw.durationHours, raw.durationMinutes);
      if (totalMin < 1) {
        this.targetError.set('Target duration must be at least 1 minute.');
        return;
      }
      if (totalMin < this.timeCurrentMinutes) {
        this.targetError.set('Target cannot be lower than current progress.');
        return;
      }
      this.tasksApi
        .update(this.task.id, {
          name,
          description,
          trackerMetadata: { totalMinutes: totalMin },
        })
        .subscribe({
          next: () => this.finishSuccess(),
          error: (err: unknown) => this.setHttpError(err),
        });
      return;
    }

    this.tasksApi
      .update(this.task.id, {
        name,
        description,
      })
      .subscribe({
        next: () => this.finishSuccess(),
        error: (err: unknown) => this.setHttpError(err),
      });
  }

  private finishSuccess(): void {
    this.context.data.onSuccess();
    this.context.completeWith();
  }

  private setHttpError(err: unknown): void {
    const body = err as { error?: { message?: string | string[] } };
    const m = body.error?.message;
    const msg = Array.isArray(m) ? m[0] : m;
    this.targetError.set(typeof msg === 'string' ? msg : 'Could not save changes.');
  }
}
