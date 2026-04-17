import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TrackerType } from '@progress-tracker/contracts';
import { TuiDialogService } from '@taiga-ui/core/portals/dialog';
import { TaskBase } from '../../entities/task/model/task.types';
import { TasksApiService } from '../../features/tasks/model/tasks-api.service';
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

      <app-button class="mt-4" (click)="openLogModal()" [disabled]="currentTask.isCompleted">
        Add progress log
      </app-button>

      <ng-template #logDialog let-context>
        <form [formGroup]="logForm" (ngSubmit)="submitLog(currentTask, context)" class="grid gap-3">
          <h3 class="text-lg font-semibold">Add log entry</h3>
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
            <app-button appearance="outline-grayscale" type="button" (click)="context.completeWith()">
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

  openLogModal(): void {
    if (!this.logDialog) {
      return;
    }
    this.dialogs.open(this.logDialog, { label: 'Add progress log' }).subscribe();
  }

  submitLog(task: TaskBase, context: { completeWith: (value?: unknown) => void }): void {
    if (this.logForm.invalid || task.isCompleted) {
      return;
    }
    const { timeSpentMinutes, progressValue } = this.logForm.getRawValue();
    const trackerMetadata = this.buildLogMetadata(task, progressValue);

    this.tasksApi
      .addLog(task.id, { timeSpentMinutes, trackerMetadata })
      .subscribe(() => this.tasksApi.getTask(task.id).subscribe((fresh) => this.task.set(fresh)));
    context.completeWith();
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
