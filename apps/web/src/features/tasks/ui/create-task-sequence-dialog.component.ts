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
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { TaskBase } from '../../../entities/task/model/task.types';
import { AppButtonComponent } from '../../../shared/ui/button/app-button.component';
import { TasksApiService } from '../model/tasks-api.service';
import { TRACKER_TYPES_IN_DISPLAY_ORDER } from '../../../entities/task/lib/tracker-display';
import { TrackerTypeLabelPipe } from '../../../entities/task/ui/tracker-type-label.pipe';

export interface CreateTaskSequenceDialogData {
  parent: TaskBase | null;
  onSuccess: () => void;
}

/** Accepts either the literal `{n}` token or a non-negative integer string. */
function tokenOrIntValidator(min = 0, max?: number): ValidatorFn {
  return (ctrl: AbstractControl): ValidationErrors | null => {
    const v = String(ctrl.value ?? '').trim();
    if (!v) return null;
    if (v === '{n}') return null;
    const num = Number(v);
    if (!Number.isInteger(num) || isNaN(num)) return { notNumber: true };
    if (num < min) return { min: { min, actual: num } };
    if (max !== undefined && num > max) return { max: { max, actual: num } };
    return null;
  };
}

/** Group-level: if durationMinutes is `{n}` and count > 59, all substituted values 1–count will exceed 59. */
function minutesTokenCountValidator(): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const minutes = String(group.get('durationMinutes')?.value ?? '').trim();
    const count = Number(group.get('count')?.value ?? 1);
    if (minutes === '{n}' && count > 59) {
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

      <!-- Hint -->
      <p class="rounded bg-slate-50 p-2.5 text-xs text-slate-500">
        {{ 'createSequence.hint' | transloco }}
      </p>

      <!-- Count -->
      <label class="grid gap-1.5 text-sm">
        <span class="font-medium text-slate-700">{{ 'createSequence.count' | transloco }}</span>
        <input
          type="number"
          formControlName="count"
          min="1"
          max="100"
          class="w-32 rounded border border-slate-300 p-2"
        />
        <p *ngIf="f.count.invalid && f.count.touched" class="text-xs text-rose-600">
          {{ 'createSequence.countError' | transloco }}
        </p>
      </label>

      <!-- Name -->
      <div class="grid gap-1.5">
        <span class="text-sm font-medium text-slate-700">{{ 'createSequence.name' | transloco }}</span>
        <div class="flex gap-2">
          <input
            #nameInput
            id="seq-name"
            type="text"
            formControlName="name"
            [placeholder]="'createSequence.namePlaceholder' | transloco"
            autocomplete="off"
            class="flex-1 rounded border border-slate-300 p-2 text-sm"
          />
          <button
            type="button"
            (click)="insertToken(nameInput, 'name')"
            [title]="'createSequence.insertTokenHint' | transloco"
            class="shrink-0 rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-600 hover:bg-slate-100"
          >{{ TOKEN }}</button>
        </div>
        <p *ngIf="f.name.invalid && f.name.touched" class="text-xs text-rose-600">
          {{ 'createSequence.nameRequired' | transloco }}
        </p>
      </div>

      <!-- Description -->
      <div class="grid gap-1.5">
        <span class="text-sm font-medium text-slate-700">{{ 'createSequence.description' | transloco }}</span>
        <div class="flex items-start gap-2">
          <textarea
            #descInput
            formControlName="description"
            rows="3"
            class="flex-1 rounded border border-slate-300 p-2 text-sm"
          ></textarea>
          <button
            type="button"
            (click)="insertToken(descInput, 'description')"
            [title]="'createSequence.insertTokenHint' | transloco"
            class="shrink-0 rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-600 hover:bg-slate-100"
          >{{ TOKEN }}</button>
        </div>
      </div>

      <!-- Task type -->
      <label class="grid gap-1.5 text-sm">
        <span class="font-medium text-slate-700">{{ 'createSequence.taskType' | transloco }}</span>
        <select formControlName="trackerType" class="rounded border border-slate-300 p-2">
          <option *ngFor="let type of trackerTypes" [value]="type">{{ type | trackerTypeLabel }}</option>
        </select>
      </label>

      <!-- NUMBER: target counter -->
      <div *ngIf="isCounterType()" class="grid gap-1.5 text-sm">
        <span class="font-medium text-slate-700">{{ 'createSequence.target' | transloco }}</span>
        <div class="flex gap-2">
          <input
            type="text"
            formControlName="total"
            class="w-32 rounded border border-slate-300 p-2 font-mono"
            [class.border-rose-400]="f.total.invalid && f.total.touched"
          />
          <button
            type="button"
            (click)="toggleToken('total', '1')"
            class="shrink-0 rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-600 hover:bg-slate-100"
          >{{ isToken('total') ? '#' : TOKEN }}</button>
        </div>
        <p *ngIf="f.total.invalid && f.total.touched" class="text-xs text-rose-600">
          {{ 'createSequence.numberFieldError' | transloco }}
        </p>
      </div>

      <!-- TIME: hours + minutes -->
      <div *ngIf="isDurationType()" class="grid gap-2 text-sm">
        <span class="font-medium text-slate-700">{{ 'createSequence.targetDuration' | transloco }}</span>
        <div class="grid grid-cols-2 gap-3">
          <!-- Hours -->
          <div class="grid gap-1">
            <span class="text-slate-600">{{ 'createSequence.hours' | transloco }}</span>
            <div class="flex gap-2">
              <input
                type="text"
                formControlName="durationHours"
                class="w-20 rounded border border-slate-300 p-2 font-mono"
                [class.border-rose-400]="f.durationHours.invalid && f.durationHours.touched"
              />
              <button
                type="button"
                (click)="toggleToken('durationHours', '0')"
                class="shrink-0 rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-600 hover:bg-slate-100"
              >{{ isToken('durationHours') ? '#' : TOKEN }}</button>
            </div>
            <p *ngIf="f.durationHours.invalid && f.durationHours.touched" class="text-xs text-rose-600">
              {{ 'createSequence.numberFieldError' | transloco }}
            </p>
          </div>
          <!-- Minutes -->
          <div class="grid gap-1">
            <span class="text-slate-600">{{ 'createSequence.minutes' | transloco }}</span>
            <div class="flex gap-2">
              <input
                type="text"
                formControlName="durationMinutes"
                class="w-20 rounded border border-slate-300 p-2 font-mono"
                [class.border-rose-400]="minutesTokenError || (f.durationMinutes.invalid && f.durationMinutes.touched)"
              />
              <button
                type="button"
                (click)="toggleToken('durationMinutes', '1')"
                class="shrink-0 rounded border border-slate-300 bg-slate-50 px-2.5 py-1.5 font-mono text-xs text-slate-600 hover:bg-slate-100"
              >{{ isToken('durationMinutes') ? '#' : TOKEN }}</button>
            </div>
            <p *ngIf="f.durationMinutes.invalid && f.durationMinutes.touched" class="text-xs text-rose-600">
              {{ 'createSequence.minutesRangeError' | transloco }}
            </p>
            <p *ngIf="minutesTokenError" class="text-xs text-rose-600">
              {{ 'createSequence.minutesTokenTooMany' | transloco: { count: f.count.value } }}
            </p>
          </div>
        </div>
        <p *ngIf="durationTooShort" class="text-xs text-rose-600">
          {{ 'createSequence.durationMinRequired' | transloco }}
        </p>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2">
        <app-button appearance="outline-grayscale" type="button" (click)="cancel()">
          {{ 'createSequence.cancel' | transloco }}
        </app-button>
        <app-button type="submit" [disabled]="saving">
          {{ 'createSequence.save' | transloco: { count: f.count.value } }}
        </app-button>
      </div>

    </form>
  `,
})
export class CreateTaskSequenceDialogComponent {
  private readonly tasksApi = inject(TasksApiService);
  private readonly fb = inject(FormBuilder);
  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<void, CreateTaskSequenceDialogData>;
  private readonly transloco = inject(TranslocoService);

  readonly trackerTypes = TRACKER_TYPES_IN_DISPLAY_ORDER;
  readonly TOKEN = '{n}';
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

  isToken(controlName: string): boolean {
    return this.form.get(controlName)?.value === this.TOKEN;
  }

  get minutesTokenError(): boolean {
    return !!this.form.errors?.['minutesTokenTooMany'];
  }

  get durationTooShort(): boolean {
    if (!this.isDurationType()) return false;
    const h = this.f.durationHours.value;
    const m = this.f.durationMinutes.value;
    // Only flag when both are static (not tokens) and sum to 0
    if (h === '{n}' || m === '{n}') return false;
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

  /** Insert `{n}` at cursor position in a text / textarea field. */
  insertToken(el: HTMLInputElement | HTMLTextAreaElement, controlName: string): void {
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const ctrl = this.form.get(controlName)!;
    const current = String(ctrl.value ?? '');
    ctrl.setValue(current.substring(0, start) + '{n}' + current.substring(end));
    ctrl.markAsDirty();
    setTimeout(() => {
      el.setSelectionRange(start + 3, start + 3);
      el.focus();
    });
  }

  /** Toggle a numeric field between `{n}` and a default numeric string. */
  toggleToken(controlName: string, defaultValue: string): void {
    const ctrl = this.form.get(controlName)!;
    ctrl.setValue(ctrl.value === '{n}' ? defaultValue : '{n}');
    ctrl.markAsDirty();
    this.form.updateValueAndValidity();
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
