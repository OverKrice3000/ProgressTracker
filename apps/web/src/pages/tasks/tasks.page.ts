import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { TuiDialogService } from '@taiga-ui/core/portals/dialog';
import { TrackerType } from '@progress-tracker/contracts';
import { TaskBase } from '../../entities/task/model/task.types';
import { TasksApiService } from '../../features/tasks/model/tasks-api.service';
import {
  CreateTaskDialogComponent,
  CreateTaskDialogData,
} from '../../features/tasks/ui/create-task-dialog.component';
import { AppButtonComponent } from '../../shared/ui/button/app-button.component';
import { TaskListViewComponent } from '../../widgets/task-list-view/ui/task-list-view.component';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [CommonModule, TaskListViewComponent, AppButtonComponent],
  template: `
    <section class="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div class="rounded-2xl bg-white p-4 shadow-sm">
        <h1 class="mb-3 text-2xl font-semibold text-slate-900">Tasks</h1>
        <div class="grid gap-3 md:grid-cols-5">
          <label class="flex items-center gap-2 text-sm">
            Root only
            <input type="checkbox" [checked]="rootOnly()" (change)="toggleRootOnly($event)" />
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Completion
            <select
              [value]="completionFilter()"
              (change)="setCompletionFilter($event)"
              class="rounded border border-slate-300 p-2"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Tracker type
            <select
              [value]="trackerFilter()"
              (change)="setTrackerFilter($event)"
              class="rounded border border-slate-300 p-2"
            >
              <option value="">All</option>
              <option *ngFor="let type of trackerTypes" [value]="type">{{ type }}</option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm">
            Sort by
            <select [value]="sortBy()" (change)="setSortBy($event)" class="rounded border border-slate-300 p-2">
              <option value="name">Alphabetic</option>
              <option value="trackerType">Type</option>
              <option value="depth">Depth</option>
            </select>
          </label>
          <app-button appearance="outline-grayscale" (click)="toggleSortOrder()">
            {{ sortOrder().toUpperCase() }}
          </app-button>
        </div>
      </div>

      <app-button (click)="openCreateModal()">Create task</app-button>
      <app-task-list-view [tasks]="tasks()" />
    </section>
  `,
})
export class TasksPage implements OnInit {
  private readonly tasksApi = inject(TasksApiService);
  private readonly dialogs = inject(TuiDialogService);

  readonly trackerTypes = Object.values(TrackerType);
  readonly tasks = signal<TaskBase[]>([]);
  readonly rootOnly = signal(true);
  readonly completionFilter = signal<'all' | 'active' | 'completed'>('all');
  readonly trackerFilter = signal<string>('');
  readonly sortBy = signal<'name' | 'trackerType' | 'depth'>('name');
  readonly sortOrder = signal<'asc' | 'desc'>('asc');

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

  openCreateModal(): void {
    const data: CreateTaskDialogData = {
      parent: null,
      onSuccess: () => this.loadTasks(),
    };
    this.dialogs.open(new PolymorpheusComponent(CreateTaskDialogComponent), {
      label: 'Create task',
      data,
    }).subscribe();
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
}
