import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { TuiDialogService } from '@taiga-ui/core/portals/dialog';
import { TrackerType } from '@progress-tracker/contracts';
import { TRACKER_TYPES_IN_DISPLAY_ORDER } from '../../entities/task/lib/tracker-display';
import { TrackerTypeLabelPipe } from '../../entities/task/ui/tracker-type-label.pipe';
import { TaskBase, TaskTreeNode } from '../../entities/task/model/task.types';
import { TasksApiService } from '../../features/tasks/model/tasks-api.service';
import {
  CreateTaskDialogComponent,
  CreateTaskDialogData,
} from '../../features/tasks/ui/create-task-dialog.component';
import { AppButtonComponent } from '../../shared/ui/button/app-button.component';
import { TaskListViewComponent } from '../../widgets/task-list-view/ui/task-list-view.component';
import { TaskHierarchyViewComponent } from '../../widgets/task-hierarchy-view/ui/task-hierarchy-view.component';
import {
  applyDisplaySort,
  buildRecentBucketRows,
  filterTasksBySearch,
  filterTreeByCompletionAndTracker,
  filterTreeBySearch,
} from './task-tree.utils';

@Component({
  selector: 'app-tasks-page',
  standalone: true,
  imports: [
    CommonModule,
    TaskListViewComponent,
    TaskHierarchyViewComponent,
    AppButtonComponent,
    TrackerTypeLabelPipe,
  ],
  template: `
    <section class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <div class="rounded-2xl bg-white p-5 shadow-sm">
        <div class="space-y-5">
          <h1 class="text-2xl font-semibold text-slate-900">Tasks</h1>

          <div class="flex flex-wrap gap-2">
          <app-button
            [appearance]="viewMode() === 'hierarchy' ? 'primary' : 'outline-grayscale'"
            size="s"
            (click)="setViewMode('hierarchy')"
          >
            Hierarchy
          </app-button>
          <app-button
            [appearance]="viewMode() === 'recent' ? 'primary' : 'outline-grayscale'"
            size="s"
            (click)="setViewMode('recent')"
          >
            Recent
          </app-button>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label class="flex flex-col gap-2 text-sm">
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
            <label class="flex flex-col gap-2 text-sm">
            Task type
            <select
              [value]="trackerFilter()"
              (change)="setTrackerFilter($event)"
              class="rounded border border-slate-300 p-2"
            >
              <option value="">All</option>
              <option *ngFor="let type of trackerTypes" [value]="type">{{ type | trackerTypeLabel }}</option>
            </select>
          </label>
            <label class="flex flex-col gap-2 text-sm sm:col-span-2">
            Search
            <input
              type="search"
              [value]="searchQuery()"
              (input)="onSearchInput($event)"
              placeholder="Filter by name…"
              class="w-full rounded border border-slate-300 p-2"
            />
          </label>
          </div>
        </div>
      </div>

      <app-button (click)="openCreateModal()">Create task</app-button>

      <ng-container *ngIf="viewMode() === 'hierarchy'">
        <p *ngIf="filteredHierarchy().length === 0" class="text-sm text-slate-500">No tasks match your filters.</p>
        <app-task-hierarchy-view
          *ngIf="filteredHierarchy().length > 0"
          [nodes]="filteredHierarchy()"
          [searchQuery]="searchQuery()"
          [expandedFolderIds]="expandedFolderIds()"
          (folderExpandToggle)="toggleFolderExpand($event)"
        />
      </ng-container>

      <ng-container *ngIf="viewMode() === 'recent'">
        <p *ngIf="filteredRecent().length === 0" class="text-sm text-slate-500">
          No tasks with progress logs match your filters.
        </p>
        <div *ngIf="recentBucketRows().length > 0" class="space-y-8">
          <section *ngFor="let row of recentBucketRows()" class="space-y-3">
            <h2 class="text-sm font-medium uppercase tracking-wide text-slate-500">{{ row.label }}</h2>
            <app-task-list-view
              [tasks]="row.tasks"
              [searchQuery]="searchQuery()"
            />
          </section>
        </div>
      </ng-container>
    </section>
  `,
})
export class TasksPage implements OnInit {
  private readonly tasksApi = inject(TasksApiService);
  private readonly dialogs = inject(TuiDialogService);

  readonly trackerTypes = TRACKER_TYPES_IN_DISPLAY_ORDER;
  readonly viewMode = signal<'hierarchy' | 'recent'>('hierarchy');
  /** Which folder task IDs are expanded in the hierarchy tree (applies at every nesting level). */
  readonly expandedFolderIds = signal<Set<string>>(new Set());
  readonly tree = signal<TaskTreeNode[]>([]);
  readonly recentTasks = signal<TaskBase[]>([]);
  readonly searchQuery = signal('');
  readonly completionFilter = signal<'all' | 'active' | 'completed'>('all');
  readonly trackerFilter = signal<string>('');

  readonly filteredHierarchy = computed(() => {
    const roots = this.tree();
    const completion = this.completionFilter();
    const tracker = this.trackerFilter() as TrackerType | '';
    const q = this.searchQuery();

    let next = roots
      .map((r) => filterTreeByCompletionAndTracker(r, completion, tracker))
      .filter((n): n is TaskTreeNode => n !== null);
    next = filterTreeBySearch(next, q);
    return applyDisplaySort(next);
  });

  readonly filteredRecent = computed((): (TaskBase & { lastTrackedAt: string })[] => {
    const withLogs = this.recentTasks() as (TaskBase & { lastTrackedAt: string })[];
    return filterTasksBySearch(withLogs, this.searchQuery()) as (TaskBase & { lastTrackedAt: string })[];
  });

  readonly recentBucketRows = computed(() => buildRecentBucketRows(this.filteredRecent()));

  ngOnInit(): void {
    this.loadTree();
  }

  setViewMode(mode: 'hierarchy' | 'recent'): void {
    if (this.viewMode() === mode) {
      return;
    }
    this.viewMode.set(mode);
    if (mode === 'hierarchy') {
      if (this.tree().length === 0) {
        this.loadTree();
      }
    } else {
      this.loadRecent();
    }
  }

  onSearchInput(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  toggleFolderExpand(taskId: string): void {
    this.expandedFolderIds.update((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }

  setCompletionFilter(event: Event): void {
    this.completionFilter.set((event.target as HTMLSelectElement).value as never);
    if (this.viewMode() === 'recent') {
      this.loadRecent();
    }
  }

  setTrackerFilter(event: Event): void {
    this.trackerFilter.set((event.target as HTMLSelectElement).value);
    if (this.viewMode() === 'recent') {
      this.loadRecent();
    }
  }

  openCreateModal(): void {
    const data: CreateTaskDialogData = {
      parent: null,
      onSuccess: () => {
        this.loadTree();
        if (this.viewMode() === 'recent') {
          this.loadRecent();
        }
      },
    };
    this.dialogs.open(new PolymorpheusComponent(CreateTaskDialogComponent), {
      label: 'Create task',
      data,
    }).subscribe();
  }

  private loadTree(): void {
    this.tasksApi.getTree().subscribe((t) => this.tree.set(t));
  }

  private loadRecent(): void {
    const c = this.completionFilter();
    this.tasksApi
      .getRecentLeaves({
        isCompleted: c === 'all' ? undefined : c === 'completed',
        trackerType: this.trackerFilter() ? (this.trackerFilter() as TrackerType) : undefined,
      })
      .subscribe((tasks) => this.recentTasks.set(tasks));
  }
}
