import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { TrackerType } from '@progress-tracker/contracts';
import { TaskBase } from '../../entities/task/model/task.types';
import { TasksApiService } from '../../features/tasks/model/tasks-api.service';

@Component({
  selector: 'app-task-detail-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page" *ngIf="task() as currentTask">
      <h1>{{ currentTask.name }}</h1>
      <p>{{ currentTask.description }}</p>
      <p>Type: {{ currentTask.trackerType }}</p>
      <p>Status: {{ currentTask.isCompleted ? 'Completed' : 'In progress' }}</p>

      <ng-container [ngSwitch]="currentTask.trackerType">
        <p *ngSwitchCase="trackerType.NUMBER">
          Progress: {{ currentTask.trackerMetadata['current'] }} / {{ currentTask.trackerMetadata['total'] }}
        </p>
        <p *ngSwitchCase="trackerType.TIME">
          Time: {{ currentTask.trackerMetadata['currentMinutes'] }} / {{ currentTask.trackerMetadata['totalMinutes'] }} minutes
        </p>
        <p *ngSwitchCase="trackerType.BOOLEAN">
          Done flag: {{ currentTask.trackerMetadata['current'] ? 'Yes' : 'No' }}
        </p>
        <p *ngSwitchDefault>
          Child tracker (folder): {{ currentTask.trackerMetadata['childIds'] ?? '[]' }}
        </p>
      </ng-container>

      <button (click)="showLogModal.set(true)" [disabled]="currentTask.isCompleted">
        Add progress log
      </button>

      <dialog [open]="showLogModal()">
        <form [formGroup]="logForm" (ngSubmit)="submitLog(currentTask)">
          <h3>Add log entry</h3>
          <label>
            Time spent (minutes)
            <input type="number" formControlName="timeSpentMinutes" />
          </label>
          <label>
            {{ trackerSpecificLabel(currentTask.trackerType) }}
            <input type="number" formControlName="progressValue" />
          </label>
          <div>
            <button type="submit" [disabled]="currentTask.isCompleted">Submit</button>
            <button type="button" (click)="showLogModal.set(false)">Cancel</button>
          </div>
        </form>
      </dialog>
    </section>
  `,
})
export class TaskDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly tasksApi = inject(TasksApiService);
  private readonly fb = inject(FormBuilder);

  readonly trackerType = TrackerType;
  readonly task = signal<TaskBase | null>(null);
  readonly showLogModal = signal(false);

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

  submitLog(task: TaskBase): void {
    if (this.logForm.invalid || task.isCompleted) {
      return;
    }
    const { timeSpentMinutes, progressValue } = this.logForm.getRawValue();
    const trackerMetadata = this.buildLogMetadata(task, progressValue);

    this.tasksApi
      .addLog(task.id, { timeSpentMinutes, trackerMetadata })
      .subscribe(() => this.tasksApi.getTask(task.id).subscribe((fresh) => this.task.set(fresh)));
    this.showLogModal.set(false);
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
