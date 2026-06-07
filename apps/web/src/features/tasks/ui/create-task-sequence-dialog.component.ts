import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TrackerType } from '@progress-tracker/contracts';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core/portals/dialog';
import { TranslocoPipe } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TaskBase } from '../../../entities/task/model/task.types';
import { AppButtonComponent } from '../../../shared/ui/button/app-button.component';
import { TasksApiService } from '../model/tasks-api.service';
import { TRACKER_TYPES_IN_DISPLAY_ORDER } from '../../../entities/task/lib/tracker-display';
import { TrackerTypeLabelPipe } from '../../../entities/task/ui/tracker-type-label.pipe';
import { validateSequenceForm } from '../lib/sequence-expression';

export interface CreateTaskSequenceDialogData {
  parent: TaskBase | null;
  onSuccess: () => void;
}

@Component({
  selector: 'app-create-task-sequence-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppButtonComponent, TrackerTypeLabelPipe, TranslocoPipe],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-5">

      <p class="rounded bg-slate-50 p-2.5 text-xs text-slate-500">
        {{ 'sequenceTask.hint' | transloco }}
        <span class="font-mono font-medium text-slate-700">{{ exampleSimple }}</span>{{ 'sequenceTask.hintOr' | transloco }}
        <span class="font-mono font-medium text-slate-700">{{ exampleMultiply }}</span>{{ 'sequenceTask.hintSuffix' | transloco }}
      </p>

      <p *ngIf="expressionError()" class="rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
        {{ expressionErrorKey() | transloco }}
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
          [placeholder]="'createTask.namePlaceholder' | transloco"
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
          <input type="text" formControlName="total" class="w-32 rounded border border-slate-300 p-2 font-mono" />
        </label>
      </div>

      <div *ngIf="isDurationType()" class="grid gap-2 text-sm">
        <span class="font-medium text-slate-700">{{ 'sequenceTask.targetDuration' | transloco }}</span>
        <div class="grid grid-cols-2 gap-3">
          <label class="grid gap-1">
            <span class="text-slate-600">{{ 'sequenceTask.hours' | transloco }}</span>
            <input type="text" formControlName="durationHours" class="rounded border border-slate-300 p-2 font-mono" />
          </label>
          <label class="grid gap-1">
            <span class="text-slate-600">{{ 'sequenceTask.minutes' | transloco }}</span>
            <input type="text" formControlName="durationMinutes" class="rounded border border-slate-300 p-2 font-mono" />
          </label>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <app-button appearance="outline-grayscale" type="button" (click)="cancel()">
          {{ 'sequenceTask.cancel' | transloco }}
        </app-button>
        <app-button type="submit" [disabled]="saveDisabled()">
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
  readonly exampleSimple = '{n}';
  readonly exampleMultiply = '{n*2}';
  readonly expressionError = signal<string | null>(null);
  saving = false;

  readonly form = this.fb.nonNullable.group({
    count: [2, [Validators.required, Validators.min(1), Validators.max(100)]],
    name: ['', Validators.required],
    description: [''],
    trackerType: [TrackerType.SUBTASK as TrackerType, Validators.required],
    total: ['1'],
    durationHours: ['0'],
    durationMinutes: ['1'],
  });

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.revalidateExpressions());
    this.revalidateExpressions();
  }

  get f() {
    return this.form.controls;
  }

  expressionErrorKey(): string {
    const err = this.expressionError();
    if (!err) return '';
    const keys: Record<string, string> = {
      expressionInvalid: 'sequenceTask.expressionInvalid',
      numberOutOfRange: 'sequenceTask.numberOutOfRange',
      minutesOutOfRange: 'sequenceTask.minutesOutOfRange',
      durationTooShort: 'sequenceTask.durationMinRequired',
    };
    return keys[err] ?? 'sequenceTask.expressionInvalid';
  }

  saveDisabled(): boolean {
    return this.saving || this.form.invalid || this.expressionError() !== null;
  }

  isCounterType(): boolean {
    return this.f.trackerType.value === TrackerType.NUMBER;
  }

  isDurationType(): boolean {
    return this.f.trackerType.value === TrackerType.TIME;
  }

  private revalidateExpressions(): void {
    const raw = this.form.getRawValue();
    this.expressionError.set(
      validateSequenceForm({
        name: raw.name,
        description: raw.description,
        trackerType: raw.trackerType,
        total: raw.total,
        durationHours: raw.durationHours,
        durationMinutes: raw.durationMinutes,
        count: raw.count,
      }),
    );
  }

  cancel(): void {
    this.context.completeWith();
  }

  submit(): void {
    this.form.markAllAsTouched();
    this.revalidateExpressions();
    if (this.saveDisabled()) return;

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
