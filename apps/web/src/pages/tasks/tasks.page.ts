import { CommonModule } from '@angular/common';
import { Component, OnInit, TemplateRef, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TrackerType } from '@progress-tracker/contracts';
import { TuiDialogService } from '@taiga-ui/core/portals/dialog';
import { TaskBase } from '../../entities/task/model/task.types';
import { TasksApiService } from '../../features/tasks/model/tasks-api.service';
import { AppButtonComponent } from '../../shared/ui/button/app-button.component';
import { AppInputComponent } from '../../shared/ui/input/app-input.component';
import { TaskListViewComponent } from '../../widgets/task-list-view/ui/task-list-view.component';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TaskListViewComponent, AppButtonComponent, AppInputComponent],
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
      <app-task-list-view [tasks]="tasks()" (createChild)="openCreateModal($event)" />

      <ng-template #createTaskDialog let-context>
        <form [formGroup]="createForm" (ngSubmit)="createTask(context)" class="grid gap-4">
          <h3 class="text-lg font-semibold">Create task</h3>

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

          <div class="grid gap-2 md:grid-cols-2">
            <label class="grid gap-1 text-sm">
              Current
              <input type="number" formControlName="current" class="rounded border border-slate-300 p-2" />
            </label>
            <label class="grid gap-1 text-sm">
              Total
              <input type="number" formControlName="total" class="rounded border border-slate-300 p-2" />
            </label>
          </div>

          <div class="flex justify-end gap-2">
            <app-button appearance="outline-grayscale" type="button" (click)="context.completeWith()">
              Cancel
            </app-button>
            <app-button type="submit">Save</app-button>
          </div>
        </form>
      </ng-template>
    </section>
  `,
})
export class TasksPage implements OnInit {
  private readonly tasksApi = inject(TasksApiService);
  private readonly fb = inject(FormBuilder);
  private readonly dialogs = inject(TuiDialogService);
  @ViewChild('createTaskDialog') private createTaskDialog?: TemplateRef<unknown>;

  readonly trackerTypes = Object.values(TrackerType);
  readonly tasks = signal<TaskBase[]>([]);
  readonly rootOnly = signal(true);
  readonly completionFilter = signal<'all' | 'active' | 'completed'>('all');
  readonly trackerFilter = signal<string>('');
  readonly sortBy = signal<'name' | 'trackerType' | 'depth'>('name');
  readonly sortOrder = signal<'asc' | 'desc'>('asc');
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
    if (!this.createTaskDialog) {
      return;
    }
    this.dialogs.open(this.createTaskDialog, { label: 'Create task' }).subscribe(() => {
      this.selectedParent.set(null);
    });
  }

  createTask(context: { completeWith: (value?: unknown) => void }): void {
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
        context.completeWith();
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
