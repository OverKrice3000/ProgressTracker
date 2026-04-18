import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TrackerType } from '@progress-tracker/contracts';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core/portals/dialog';
import { TaskBase } from '../../../entities/task/model/task.types';
import { AppButtonComponent } from '../../../shared/ui/button/app-button.component';
import { AppInputComponent } from '../../../shared/ui/input/app-input.component';
import { TasksApiService } from '../model/tasks-api.service';
import { buildTrackerMetadata } from '../lib/task-tracker-metadata';

export interface CreateTaskDialogData {
  parent: TaskBase | null;
  onSuccess: () => void;
}

@Component({
  selector: 'app-create-task-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppButtonComponent, AppInputComponent],
  template: `
    <form [formGroup]="createForm" (ngSubmit)="submit()" class="grid gap-4">
      <app-input label="Name" [control]="createForm.controls.name" error="Name is required" />

      <label class="grid gap-1 text-sm">
        Description
        <textarea formControlName="description" class="min-h-20 rounded border border-slate-300 p-2"></textarea>
      </label>

      <label class="grid gap-1 text-sm">
        Tracker type
        <select formControlName="trackerType" class="rounded border border-slate-300 p-2">
          <option *ngFor="let type of trackerTypes" [value]="type">{{ type }}</option>
        </select>
      </label>

      <label *ngIf="showTotalFields()" class="grid gap-1 text-sm">
        Total
        <input type="number" formControlName="total" min="1" class="rounded border border-slate-300 p-2" />
      </label>

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

  readonly trackerTypes = Object.values(TrackerType);

  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    trackerType: [TrackerType.SUBTASK as TrackerType, Validators.required],
    total: [1, [Validators.required, Validators.min(1)]],
  });

  showTotalFields(): boolean {
    const t = this.createForm.controls.trackerType.value;
    return t === TrackerType.NUMBER || t === TrackerType.TIME;
  }

  cancel(): void {
    this.context.completeWith();
  }

  submit(): void {
    if (this.createForm.invalid) {
      return;
    }
    const raw = this.createForm.getRawValue();
    const trackerType = raw.trackerType;
    const total = raw.total;
    if (
      (trackerType === TrackerType.NUMBER || trackerType === TrackerType.TIME) &&
      (total === null || total === undefined || total < 1)
    ) {
      return;
    }
    const trackerMetadata = buildTrackerMetadata(trackerType, total);
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
        this.createForm.patchValue({ name: '', description: '', total: 1 });
      });
  }
}
