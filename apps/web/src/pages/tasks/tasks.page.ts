import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TrackerType } from '@progress-tracker/contracts';
import { TaskBase } from '../../entities/task/model/task.types';
import { TasksApiService } from '../../features/tasks/model/tasks-api.service';
import { TaskListViewComponent } from '../../widgets/task-list-view/ui/task-list-view.component';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TaskListViewComponent],
  template: `
    <section class="page">
      <h1>Tasks</h1>
      <div class="controls">
        <label>
          Root only
          <input type="checkbox" [checked]="rootOnly()" (change)="toggleRootOnly($event)" />
        </label>
        <label>
          Completion
          <select [value]="completionFilter()" (change)="setCompletionFilter($event)">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </label>
        <label>
          Tracker type
          <select [value]="trackerFilter()" (change)="setTrackerFilter($event)">
            <option value="">All</option>
            <option *ngFor="let type of trackerTypes" [value]="type">{{ type }}</option>
          </select>
        </label>
        <label>
          Sort by
          <select [value]="sortBy()" (change)="setSortBy($event)">
            <option value="name">Alphabetic</option>
            <option value="trackerType">Type</option>
            <option value="depth">Depth</option>
          </select>
        </label>
        <button (click)="toggleSortOrder()">{{ sortOrder().toUpperCase() }}</button>
      </div>

      <button (click)="openCreateModal()">Create task</button>
      <app-task-list-view [tasks]="tasks()" (createChild)="openCreateModal($event)" />

      <dialog [open]="showCreateModal()">
        <form [formGroup]="createForm" (ngSubmit)="createTask()">
          <h3>Create task</h3>
          <label>Name <input formControlName="name" /></label>
          <label>Description <textarea formControlName="description"></textarea></label>
          <label>
            Tracker type
            <select formControlName="trackerType">
              <option *ngFor="let type of trackerTypes" [value]="type">{{ type }}</option>
            </select>
          </label>
          <label>Current <input type="number" formControlName="current" /></label>
          <label>Total <input type="number" formControlName="total" /></label>
          <div>
            <button type="submit">Save</button>
            <button type="button" (click)="closeCreateModal()">Cancel</button>
          </div>
        </form>
      </dialog>
    </section>
  `,
})
export class TasksPage implements OnInit {
  private readonly tasksApi = inject(TasksApiService);
  private readonly fb = inject(FormBuilder);

  readonly trackerTypes = Object.values(TrackerType);
  readonly tasks = signal<TaskBase[]>([]);
  readonly rootOnly = signal(true);
  readonly completionFilter = signal<'all' | 'active' | 'completed'>('all');
  readonly trackerFilter = signal<string>('');
  readonly sortBy = signal<'name' | 'trackerType' | 'depth'>('name');
  readonly sortOrder = signal<'asc' | 'desc'>('asc');

  readonly showCreateModal = signal(false);
  readonly selectedParent = signal<TaskBase | null>(null);

  readonly createForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    description: [''],
    trackerType: [TrackerType.SUBTASK as TrackerType, Validators.required],
    current: [0, Validators.required],
    total: [1, Validators.required],
  });

  ngOnInit(): void {
    this.loadTasks();
  }

  toggleRootOnly(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.rootOnly.set(checked);
    this.loadTasks();
  }

  setCompletionFilter(event: Event): void {
    this.completionFilter.set((event.target as HTMLSelectElement).value as never);
    this.loadTasks();
  }

  setTrackerFilter(event: Event): void {
    this.trackerFilter.set((event.target as HTMLSelectElement).value);
    this.loadTasks();
  }

  setSortBy(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as never);
    this.loadTasks();
  }

  toggleSortOrder(): void {
    this.sortOrder.update((value) => (value === 'asc' ? 'desc' : 'asc'));
    this.loadTasks();
  }

  openCreateModal(parent: TaskBase | null = null): void {
    this.selectedParent.set(parent);
    this.showCreateModal.set(true);
  }

  closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.selectedParent.set(null);
  }

  createTask(): void {
    if (this.createForm.invalid) {
      return;
    }
    const raw = this.createForm.getRawValue();
    const trackerType = raw.trackerType;
    const trackerMetadata = this.buildTrackerMetadata(trackerType, raw.current, raw.total);

    this.tasksApi
      .create({
        parentId: this.selectedParent()?.id ?? null,
        name: raw.name,
        description: raw.description,
        trackerType,
        trackerMetadata,
      })
      .subscribe(() => {
        this.closeCreateModal();
        this.createForm.patchValue({ name: '', description: '' });
        this.loadTasks();
      });
  }

  private loadTasks(): void {
    this.tasksApi
      .list({
        rootOnly: this.rootOnly(),
        isCompleted:
          this.completionFilter() === 'all'
            ? undefined
            : this.completionFilter() === 'completed',
        trackerType: this.trackerFilter() ? (this.trackerFilter() as TrackerType) : undefined,
        sortBy: this.sortBy(),
        sortOrder: this.sortOrder(),
      })
      .subscribe((tasks) => this.tasks.set(tasks));
  }

  private buildTrackerMetadata(type: TrackerType, current: number, total: number) {
    if (type === TrackerType.BOOLEAN) {
      return { current: Boolean(current), total: true };
    }
    if (type === TrackerType.TIME) {
      return { currentMinutes: current, totalMinutes: total };
    }
    if (type === TrackerType.SUBTASK) {
      return { childIds: [] as string[] };
    }
    return { current, total };
  }
}
