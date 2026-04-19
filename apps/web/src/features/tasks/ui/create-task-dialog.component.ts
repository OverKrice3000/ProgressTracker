import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TrackerType } from '@progress-tracker/contracts';
import { TRACKER_TYPES_IN_DISPLAY_ORDER } from '../../../entities/task/lib/tracker-display';
import { TrackerTypeLabelPipe } from '../../../entities/task/ui/tracker-type-label.pipe';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core/portals/dialog';
import { TaskBase } from '../../../entities/task/model/task.types';
import { AppButtonComponent } from '../../../shared/ui/button/app-button.component';
import { TasksApiService } from '../model/tasks-api.service';
import { buildTrackerMetadata } from '../lib/task-tracker-metadata';
import { combineHoursMinutes } from '../lib/duration-minutes';

export interface CreateTaskDialogData {
  parent: TaskBase | null;
  onSuccess: () => void;
}

@Component({
  selector: 'app-create-task-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppButtonComponent, TrackerTypeLabelPipe],
  template: `
    <form [formGroup]="createForm" (ngSubmit)="submit()" class="grid gap-4">
      <div class="grid gap-2">
        <label class="grid gap-2 text-sm" for="create-task-name">
          Name
          <input
            id="create-task-name"
            type="text"
            formControlName="name"
            placeholder="Enter task name..."
            autocomplete="off"
            class="w-full rounded border border-slate-300 p-2"
            [attr.aria-invalid]="
              createForm.controls.name.invalid && (createForm.controls.name.dirty || createForm.controls.name.touched)
            "
            [attr.aria-describedby]="
              createForm.controls.name.invalid && (createForm.controls.name.dirty || createForm.controls.name.touched)
                ? 'create-task-name-error'
                : null
            "
          />
        </label>
        <p
          id="create-task-name-error"
          *ngIf="createForm.controls.name.invalid && (createForm.controls.name.dirty || createForm.controls.name.touched)"
          class="text-xs text-rose-600"
          role="alert"
        >
          Name is required
        </p>
      </div>

      <label class="grid gap-2 text-sm">
        Description
        <textarea formControlName="description" class="min-h-20 rounded border border-slate-300 p-2"></textarea>
      </label>

      <label class="grid gap-2 text-sm">
        Task type
        <select formControlName="trackerType" class="rounded border border-slate-300 p-2">
          <option *ngFor="let type of trackerTypes" [value]="type">{{ type | trackerTypeLabel }}</option>
        </select>
      </label>

      <label *ngIf="isCounterType()" class="grid gap-2 text-sm">
        Target
        <input type="number" formControlName="total" min="1" class="rounded border border-slate-300 p-2" />
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
              class="rounded border border-slate-300 p-2"
            />
          </label>
          <label class="grid gap-1">
            Minutes
            <input
              type="number"
              formControlName="durationMinutes"
              min="0"
              max="59"
              class="rounded border border-slate-300 p-2"
            />
          </label>
        </div>
      </div>

      <div class="flex justify-end gap-2">
        <app-button appearance="outline-grayscale" type="button" (click)="cancel()">Cancel</app-button>
        <app-button type="submit">Save</app-button>
      </div>
    </form>
  `,
})
export class CreateTaskDialogComponent {
  private readonly tasksApi = inject(TasksApiService);
  private readonly fb = inject(FormBuilder);
  private readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<void, CreateTaskDialogData>;

  readonly trackerTypes = TRACKER_TYPES_IN_DISPLAY_ORDER;

  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    trackerType: [TrackerType.SUBTASK as TrackerType, Validators.required],
    total: [1, [Validators.required, Validators.min(1)]],
    durationHours: [0, [Validators.min(0)]],
    durationMinutes: [1, [Validators.min(0), Validators.max(59)]],
  });

  isCounterType(): boolean {
    return this.createForm.controls.trackerType.value === TrackerType.NUMBER;
  }

  isDurationType(): boolean {
    return this.createForm.controls.trackerType.value === TrackerType.TIME;
  }

  cancel(): void {
    this.context.completeWith();
  }

  submit(): void {
    if (this.createForm.invalid) {
      this.createForm.controls.name.markAsTouched();
      return;
    }
    const raw = this.createForm.getRawValue();
    const trackerType = raw.trackerType;

    if (trackerType === TrackerType.NUMBER) {
      const total = raw.total;
      if (total === null || total === undefined || total < 1) {
        return;
      }
      this.createWithMetadata(trackerType, buildTrackerMetadata(trackerType, total));
      return;
    }

    if (trackerType === TrackerType.TIME) {
      const totalMinutes = combineHoursMinutes(raw.durationHours, raw.durationMinutes);
      if (totalMinutes < 1) {
        return;
      }
      this.createWithMetadata(trackerType, buildTrackerMetadata(trackerType, totalMinutes));
      return;
    }

    this.createWithMetadata(trackerType, buildTrackerMetadata(trackerType, 1));
  }

  private createWithMetadata(trackerType: TrackerType, trackerMetadata: Record<string, unknown>): void {
    const raw = this.createForm.getRawValue();
    const parentId = this.context.data.parent?.id ?? null;

    this.tasksApi
      .create({
        parentId,
        name: raw.name,
        description: raw.description,
        trackerType,
        trackerMetadata,
      })
      .subscribe(() => {
        this.context.data.onSuccess();
        this.context.completeWith();
        this.createForm.patchValue({
          name: '',
          description: '',
          total: 1,
          durationHours: 0,
          durationMinutes: 1,
        });
      });
  }
}
