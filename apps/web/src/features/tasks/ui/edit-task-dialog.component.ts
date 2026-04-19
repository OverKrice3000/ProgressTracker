import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core/portals/dialog';
import { TaskBase } from '../../../entities/task/model/task.types';
import { AppButtonComponent } from '../../../shared/ui/button/app-button.component';
import { TasksApiService } from '../model/tasks-api.service';

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

      <div class="flex justify-end gap-2">
        <app-button appearance="outline-grayscale" type="button" (click)="cancel()">Cancel</app-button>
        <app-button type="submit">Save</app-button>
      </div>
    </form>
  `,
})
export class EditTaskDialogComponent {
  private readonly tasksApi = inject(TasksApiService);
  private readonly fb = inject(FormBuilder);
  readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<void, EditTaskDialogData>;

  readonly editForm = this.fb.nonNullable.group({
    name: [this.context.data.task.name, Validators.required],
    description: [this.context.data.task.description ?? ''],
  });

  cancel(): void {
    this.context.completeWith();
  }

  submit(): void {
    if (this.editForm.invalid) {
      this.editForm.controls.name.markAsTouched();
      return;
    }
    const raw = this.editForm.getRawValue();
    this.tasksApi
      .update(this.context.data.task.id, {
        name: raw.name.trim(),
        description: raw.description.trim(),
      })
      .subscribe(() => {
        this.context.data.onSuccess();
        this.context.completeWith();
      });
  }
}
