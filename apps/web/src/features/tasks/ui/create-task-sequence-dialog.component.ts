import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { TrackerType } from '@progress-tracker/contracts';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core/portals/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { TaskBase } from '../../../entities/task/model/task.types';
import { AppButtonComponent } from '../../../shared/ui/button/app-button.component';
import { TasksApiService } from '../model/tasks-api.service';
import { TRACKER_TYPES_IN_DISPLAY_ORDER } from '../../../entities/task/lib/tracker-display';
import { TrackerTypeLabelPipe } from '../../../entities/task/ui/tracker-type-label.pipe';

export interface CreateTaskSequenceDialogData {
  parent: TaskBase | null;
  onSuccess: () => void;
}

const SEQUENCE_TOKEN = '{n}';

/** Accepts either the literal `{n}` token or a non-negative integer string. */
function tokenOrIntValidator(min = 0, max?: number): ValidatorFn {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    const v = String(ctrl.value ?? '').trim();
    if (!v) return null;
    if (v === SEQUENCE_TOKEN) return null;
    const num = Number(v);
    if (!Number.isInteger(num) || isNaN(num)) return { notNumber: true };
    if (num < min) return { min: { min, actual: num } };
    if (max !== undefined && num > max) return { max: { max, actual: num } };
    return null;
  };
}

/** Group-level: if durationMinutes is `{n}` and count > 59, substituted values 1–count will exceed 59. */
function minutesTokenCountValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const minutes = String(group.get('durationMinutes')?.value ?? '').trim();
    const count = Number(group.get('count')?.value ?? 1);
    if (minutes === SEQUENCE_TOKEN && count > 59) {
      return { minutesTokenTooMany: { count } };
    }
    return null;
  };
}

@Component({
  selector: 'app-create-task-sequence-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppButtonComponent, TrackerTypeLabelPipe, TranslocoPipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-5">

      <p class="rounded bg-slate-50 p-2.5 text-xs text-slate-500">
        {{ 'sequenceTask.hint' | transloco }}
        <span class="font-mono font-medium text-slate-700">{{ sequenceToken }}</span>
        {{ 'sequenceTask.hintSuffix' | transloco }}
      </p>

      <label class="grid gap-1.5 text-sm">
        <span class="font-medium text-slate-700">{{ 'sequenceTask.count' | transloco }}</span>
        <input
          type="number"
          formControlName="count"
          min="1"
          max="100"
          class="w-32 rounded border border-slate-300 p-2"
        />
        <p *ngIf="f.count.invalid && f.count.touched" class="text-xs text-rose-600">
          {{ 'sequenceTask.countError' | transloco }}
        </p>
      </label>

      <label class="grid gap-1.5 text-sm" for="seq-name">
        <span class="font-medium text-slate-700">{{ 'sequenceTask.name' | transloco }}</span>
        <input
          id="seq-name"
          type="text"
          formControlName="name"
          [placeholder]="'sequenceTask.namePlaceholder' | transloco"
          autocomplete="off"
          class="w-full rounded border border-slate-300 p-2 text-sm"
        />
        <p *ngIf="f.name.invalid && f.name.touched" class="text-xs text-rose-600">
          {{ 'sequenceTask.nameRequired' | transloco }}
        </p>
      </label>

      <label class="grid gap-1.5 text-sm">
        <span class="font-medium text-slate-700">{{ 'sequenceTask.description' | transloco }}</span>
        <textarea formControlName="description" rows="3" class="rounded border border-slate-300 p-2 text-sm"></textarea>
      </label>

      <label class="grid gap-1.5 text-sm">
        <span class="font-medium text-slate-700">{{ 'sequenceTask.taskType' | transloco }}</span>
        <select formControlName="trackerType" class="rounded border border-slate-300 p-2">
          <option *ngFor="let type of trackerTypes" [value]="type">{{ type | trackerTypeLabel }}</option>
        </select>
      </label>

      <div *ngIf="isCounterType()" class="grid gap-1.5 text-sm">
        <label class="grid gap-1.5">
          <span class="font-medium text-slate-700">{{ 'sequenceTask.target' | transloco }}</span>
          <input
            type="text"
            formControlName="total"
            class="w-32 rounded border border-slate-300 p-2 font-mono"
            [class.border-rose-400]="f.total.invalid && f.total.touched"
          />
        </label>
        <p *ngIf="f.total.invalid && f.total.touched" class="text-xs text-rose-600">
          {{ 'sequenceTask.numberFieldError' | transloco }}
        </p>
      </div>

      <div *ngIf="isDurationType()" class="grid gap-2 text-sm">
        <span class="font-medium text-slate-700">{{ 'sequenceTask.targetDuration' | transloco }}</span>
        <div class="grid grid-cols-2 gap-3">
          <label class="grid gap-1">
            <span class="text-slate-600">{{ 'sequenceTask.hours' | transloco }}</span>
            <input
              type="text"
              formControlName="durationHours"
              class="rounded border border-slate-300 p-2 font-mono"
              [class.border-rose-400]="f.durationHours.invalid && f.durationHours.touched"
            />
            <p *ngIf="f.durationHours.invalid && f.durationHours.touched" class="text-xs text-rose-600">
              {{ 'sequenceTask.numberFieldError' | transloco }}
            </p>
          </label>
          <label class="grid gap-1">
            <span class="text-slate-600">{{ 'sequenceTask.minutes' | transloco }}</span>
            <input
              type="text"
              formControlName="durationMinutes"
              class="rounded border border-slate-300 p-2 font-mono"
              [class.border-rose-400]="minutesTokenError || (f.durationMinutes.invalid && f.durationMinutes.touched)"
            />
            <p *ngIf="f.durationMinutes.invalid && f.durationMinutes.touched" class="text-xs text-rose-600">
              {{ 'sequenceTask.minutesRangeError' | transloco }}
            </p>
            <p *ngIf="minutesTokenError" class="text-xs text-rose-600">
              {{ 'sequenceTask.minutesTokenTooMany' | transloco: { count: f.count.value } }}
            </p>
          </label>
        </div>
        <p *ngIf="durationTooShort" class="text-xs text-rose-600">
          {{ 'sequenceTask.durationMinRequired' | transloco }}
        </p>
      </div>

      <div class="flex justify-end gap-2">
        <app-button appearance="outline-grayscale" type="button" (click)="cancel()">
          {{ 'sequenceTask.cancel' | transloco }}
        </app-button>
        <app-button type="submit" [disabled]="saving">
          {{ 'sequenceTask.save' | transloco: { count: f.count.value } }}
        </app-button>
      </div>

    </form>
  `,
})
export class CreateTaskSequenceDialogComponent {
  private readonly tasksApi = inject(TasksApiService);
  private readonly fb = inject(FormBuilder);
  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<void, CreateTaskSequenceDialogData>;

  readonly trackerTypes = TRACKER_TYPES_IN_DISPLAY_ORDER;
  readonly sequenceToken = SEQUENCE_TOKEN;
  saving = false;

  readonly form = this.fb.nonNullable.group(
    {
      count: [2, [Validators.required, Validators.min(1), Validators.max(100)]],
      name: ['', Validators.required],
      description: [''],
      trackerType: [TrackerType.SUBTASK as TrackerType, Validators.required],
      total: ['1', [tokenOrIntValidator(1)]],
      durationHours: ['0', [tokenOrIntValidator(0)]],
      durationMinutes: ['1', [tokenOrIntValidator(0, 59)]],
    },
    { validators: minutesTokenCountValidator() },
  );

  get f() {
    return this.form.controls;
  }

  get minutesTokenError(): boolean {
    return !!this.form.errors?.['minutesTokenTooMany'];
  }

  get durationTooShort(): boolean {
    if (!this.isDurationType()) return false;
    const h = this.f.durationHours.value;
    const m = this.f.durationMinutes.value;
    if (h === SEQUENCE_TOKEN || m === SEQUENCE_TOKEN) return false;
    const hours = parseInt(h, 10) || 0;
    const minutes = parseInt(m, 10) || 0;
    return hours * 60 + minutes < 1;
  }

  isCounterType(): boolean {
    return this.f.trackerType.value === TrackerType.NUMBER;
  }

  isDurationType(): boolean {
    return this.f.trackerType.value === TrackerType.TIME;
  }

  cancel(): void {
    this.context.completeWith();
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.durationTooShort || this.minutesTokenError || this.saving) return;

    const { count, name, description, trackerType, total, durationHours, durationMinutes } =
      this.form.getRawValue();

    this.saving = true;
    this.tasksApi
      .createSequence({
        parentId: this.context.data.parent?.id ?? undefined,
        name,
        description: description || undefined,
        trackerType,
        total: trackerType === TrackerType.NUMBER ? total : undefined,
        durationHours: trackerType === TrackerType.TIME ? durationHours : undefined,
        durationMinutes: trackerType === TrackerType.TIME ? durationMinutes : undefined,
        count,
      })
      .subscribe({
        next: () => {
          this.context.data.onSuccess();
          this.context.completeWith();
        },
        error: () => {
          this.saving = false;
        },
      });
  }
}
