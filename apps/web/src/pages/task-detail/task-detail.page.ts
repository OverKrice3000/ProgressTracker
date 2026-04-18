import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TrackerType } from '@progress-tracker/contracts';
import { TuiDialogService } from '@taiga-ui/core/portals/dialog';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { switchMap } from 'rxjs';
import { TaskBase } from '../../entities/task/model/task.types';
import { TasksApiService } from '../../features/tasks/model/tasks-api.service';
import {
  CreateTaskDialogComponent,
  CreateTaskDialogData,
} from '../../features/tasks/ui/create-task-dialog.component';
import { AppButtonComponent } from '../../shared/ui/button/app-button.component';
import { AppInputComponent } from '../../shared/ui/input/app-input.component';
import { TaskStatusBadgeComponent } from '../../entities/task/ui/task-status-badge.component';

@Component({
  selector: 'app-task-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    AppButtonComponent,
    AppInputComponent,
    TaskStatusBadgeComponent,
  ],
  template: `
    <section class="mx-auto w-full max-w-3xl p-4" *ngIf="task() as currentTask">
      <div class="space-y-2 rounded-2xl bg-white p-5 shadow-sm">
        <h1 class="text-2xl font-semibold">{{ currentTask.name }}</h1>
        <p class="text-sm text-slate-600">{{ currentTask.description }}</p>
        <p class="text-xs text-slate-500">Type: {{ currentTask.trackerType }}</p>
        <app-task-status-badge [isCompleted]="currentTask.isCompleted" />
      </div>

      <ng-container [ngSwitch]="currentTask.trackerType">
        <p *ngSwitchCase="trackerType.NUMBER" class="mt-3 text-sm">
          Progress: {{ currentTask.trackerMetadata['current'] }} / {{ currentTask.trackerMetadata['total'] }}
        </p>
        <p *ngSwitchCase="trackerType.TIME" class="mt-3 text-sm">
          Time: {{ currentTask.trackerMetadata['currentMinutes'] }} / {{ currentTask.trackerMetadata['totalMinutes'] }} minutes
        </p>
        <p *ngSwitchCase="trackerType.BOOLEAN" class="mt-3 text-sm">
          Done flag: {{ currentTask.trackerMetadata['current'] ? 'Yes' : 'No' }}
        </p>
        <p *ngSwitchDefault class="mt-3 text-sm">
          Child tracker (folder): {{ currentTask.trackerMetadata['childIds'] ?? '[]' }}
        </p>
      </ng-container>

      <div class="mt-4 flex flex-wrap gap-2">
        <app-button
          *ngIf="currentTask.trackerType === trackerType.SUBTASK"
          (click)="openCreateChildModal()"
          [disabled]="currentTask.isCompleted"
        >
          Create child
        </app-button>
        <app-button
          *ngIf="currentTask.trackerType !== trackerType.SUBTASK"
          (click)="openLogModal()"
          [disabled]="currentTask.isCompleted"
        >
          Add progress log
        </app-button>
      </div>

      <ng-template #logDialog let-completeWith="completeWith">
        <form [formGroup]="logForm" (ngSubmit)="submitLog(currentTask, completeWith)" class="grid gap-3">
          <app-input
            label="Time spent (minutes)"
            type="number"
            [control]="logForm.controls.timeSpentMinutes"
            error="Time spent is required"
          />
          <app-input
            [label]="trackerSpecificLabel(currentTask.trackerType)"
            type="number"
            [control]="logForm.controls.progressValue"
            error="Progress value is required"
          />
          <div class="flex justify-end gap-2">
            <app-button appearance="outline-grayscale" type="button" (click)="completeWith()">
              Cancel
            </app-button>
            <app-button type="submit" [disabled]="currentTask.isCompleted">Submit</app-button>
          </div>
        </form>
      </ng-template>
    </section>
  `,
})
export class TaskDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tasksApi = inject(TasksApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialogs = inject(TuiDialogService);
  @ViewChild('logDialog') private logDialog?: TemplateRef<unknown>;

  readonly trackerType = TrackerType;
  readonly task = signal<TaskBase | null>(null);

  readonly logForm = this.fb.nonNullable.group({
    timeSpentMinutes: [0, [Validators.required, Validators.min(0), Validators.max(1440)]],
    progressValue: [0, Validators.required],
  });

  ngOnInit(): void {
    const taskId = this.route.snapshot.paramMap.get('id');
    if (!taskId) {
      return;
    }
    this.tasksApi.getTask(taskId).subscribe((task) => this.task.set(task));
  }

  trackerSpecificLabel(type: TrackerType): string {
    switch (type) {
      case TrackerType.TIME:
        return 'New current minutes';
      case TrackerType.BOOLEAN:
        return '1 for done, 0 for not done';
      case TrackerType.SUBTASK:
        return 'Child count (read-only proxy)';
      default:
        return 'New current value';
    }
  }

  openCreateChildModal(): void {
    const t = this.task();
    if (!t || t.trackerType !== TrackerType.SUBTASK || t.isCompleted) {
      return;
    }
    const data: CreateTaskDialogData = {
      parent: t,
      onSuccess: () => this.tasksApi.getTask(t.id).subscribe((fresh) => this.task.set(fresh)),
    };
    this.dialogs.open(new PolymorpheusComponent(CreateTaskDialogComponent), {
      label: 'Create task',
      data,
    }).subscribe();
  }

  openLogModal(): void {
    const t = this.task();
    if (!this.logDialog || !t || t.trackerType === TrackerType.SUBTASK) {
      return;
    }
    this.dialogs.open(this.logDialog, { label: 'Add progress log' }).subscribe();
  }

  submitLog(task: TaskBase, completeWith: (value?: unknown) => void): void {
    if (this.logForm.invalid || task.isCompleted || task.trackerType === TrackerType.SUBTASK) {
      return;
    }
    const raw = this.logForm.getRawValue();
    const timeSpentMinutes = Number(raw.timeSpentMinutes);
    const progressValue = Number(raw.progressValue);
    const trackerMetadata = this.buildLogMetadata(task, progressValue);

    this.tasksApi
      .addLog(task.id, { timeSpentMinutes, trackerMetadata })
      .pipe(switchMap(() => this.tasksApi.getTask(task.id)))
      .subscribe({
        next: (fresh) => {
          this.task.set(fresh);
          completeWith();
        },
      });
  }

  private buildLogMetadata(task: TaskBase, progressValue: number): Record<string, unknown> {
    if (task.trackerType === TrackerType.BOOLEAN) {
      return {
        ...(task.trackerMetadata as Record<string, unknown>),
        current: progressValue >= 1,
      };
    }
    if (task.trackerType === TrackerType.TIME) {
      return {
        ...(task.trackerMetadata as Record<string, unknown>),
        currentMinutes: progressValue,
      };
    }
    if (task.trackerType === TrackerType.SUBTASK) {
      return task.trackerMetadata as Record<string, unknown>;
    }
    return {
      ...(task.trackerMetadata as Record<string, unknown>),
      current: progressValue,
    };
  }
}
