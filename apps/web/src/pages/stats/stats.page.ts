import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TrackerType } from '@progress-tracker/contracts';
import { forkJoin } from 'rxjs';
import { StatsApiService, StatsResponse } from '../../features/stats/model/stats-api.service';
import { TasksApiService } from '../../features/tasks/model/tasks-api.service';
import { TaskTreeNode } from '../../entities/task/model/task.types';
import { formatDurationMinutes } from '../../shared/lib/format-duration';
import { STATS_UNTRACKED_SLICE_COLOR } from '../../shared/lib/stats-slice-color';
import { AppButtonComponent } from '../../shared/ui/button/app-button.component';
import {
  DrilldownPieComponent,
  PieNode,
} from '../../widgets/stats/ui/drilldown-pie.component';
import { findNodeInTree } from '../tasks/task-tree.utils';
import {
  STATS_UNTRACKED_ID,
  buildMinutesMap,
  buildStatsTableRows,
  buildTaskSliceColorMap,
  buildVisiblePieSlices,
  filterStatsTreeByPositiveTime,
} from './stats-view.utils';

@Component({
  selector: 'app-stats-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, DrilldownPieComponent, AppButtonComponent],
  template: `
    <section class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <div class="rounded-2xl bg-white p-5 shadow-sm">
        <div class="space-y-5">
          <h1 class="text-2xl font-semibold text-slate-900">Stats</h1>
          <form [formGroup]="form" (ngSubmit)="load()" class="flex flex-wrap items-end gap-4">
            <label class="grid gap-2 text-sm text-slate-700">
              From
              <input type="date" formControlName="from" class="rounded border border-slate-300 p-2" />
            </label>
            <label class="grid gap-2 text-sm text-slate-700">
              To
              <input type="date" formControlName="to" class="rounded border border-slate-300 p-2" />
            </label>
            <label class="grid gap-2 text-sm text-slate-700">
              Idle hours per day
              <input
                type="number"
                min="0"
                max="24"
                formControlName="idleHours"
                class="w-24 rounded border border-slate-300 p-2"
              />
            </label>
            <app-button type="submit">Refresh</app-button>
            <label class="flex cursor-pointer items-center gap-2 pb-2 text-sm text-slate-700">
              <input
                type="checkbox"
                [checked]="showUntracked()"
                (change)="onShowUntrackedChange($event)"
              />
              Show Untracked Time
            </label>
          </form>
        </div>
      </div>

      <div *ngIf="summary() as value" class="rounded-2xl bg-white p-5 shadow-sm">
        <div class="space-y-2 text-sm">
          <p class="text-slate-700">
            <span class="font-medium">Total time logged (period):</span>
            {{ formatDuration(value.totals.loggedMinutes) }}
          </p>
          <p class="text-slate-600">
            <span class="font-medium">24h breakdown ({{ value.range.days }} day(s)):</span>
            Logged {{ formatDuration(value.totals.loggedMinutes) }}, idle allowance
            {{ formatDuration(value.totals.idleMinutes) }}, untracked
            {{ formatDuration(value.totals.untrackedMinutes) }}
          </p>
        </div>
      </div>

      @defer {
        <app-drilldown-pie [nodes]="pieNodes()" (segmentClick)="onPieSegmentClick($event)" />
      } @placeholder {
        <p class="text-sm text-slate-500">Loading chart...</p>
      }

      <div *ngIf="summary() as s" class="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-slate-900">Time by task</h2>
          <p *ngIf="tableRows().length === 0" class="text-sm text-slate-500">
            No tasks in this period.
          </p>
          <table *ngIf="tableRows().length > 0" class="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-slate-600">
                <th class="w-10 py-2 pr-1"></th>
                <th class="py-2 pr-4 font-medium">Task</th>
                <th class="py-2 pr-4 font-medium">Time logged (period)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of tableRows()" class="border-b border-slate-100">
                <td
                  class="py-2 pr-1 align-middle"
                  [style.padding-left.px]="8 + row.depth * 24"
                >
                  <button
                    *ngIf="row.isExpandable"
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                    [attr.aria-expanded]="row.isExpanded"
                    [attr.aria-label]="row.isExpanded ? 'Collapse folder' : 'Expand folder'"
                    (click)="toggleFolderExpand(row.taskId); $event.stopPropagation()"
                  >
                    <svg
                      class="h-5 w-5 transition-transform duration-150"
                      [class.rotate-90]="row.isExpanded"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </td>
                <td class="py-2 pr-4">
                  <span class="inline-flex items-center gap-2">
                    <span
                      *ngIf="row.showSliceColor"
                      class="h-2.5 w-2.5 shrink-0 rounded-full border border-slate-300/90"
                      [style.background-color]="row.sliceColor"
                      aria-hidden="true"
                    ></span>
                    <span *ngIf="!row.showSliceColor" class="h-2.5 w-2.5 shrink-0" aria-hidden="true"></span>
                    <a
                      *ngIf="row.taskId !== untrackedId"
                      [routerLink]="['/task', row.taskId]"
                      class="font-medium text-blue-600 hover:underline"
                    >
                      {{ row.name }}
                    </a>
                    <span *ngIf="row.taskId === untrackedId" class="font-medium text-slate-700">{{
                      row.name
                    }}</span>
                  </span>
                </td>
                <td class="py-2 pr-4">{{ formatDuration(row.minutes) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  `,
})
export class StatsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly statsApi = inject(StatsApiService);
  private readonly tasksApi = inject(TasksApiService);
  private readonly today = this.formatLocalDate(new Date());

  readonly summary = signal<StatsResponse | null>(null);
  readonly taskTree = signal<TaskTreeNode[]>([]);
  readonly expandedFolderIds = signal<Set<string>>(new Set());
  /** When false, Untracked is hidden from chart and table; pie uses only logged task time. */
  readonly showUntracked = signal(true);

  readonly untrackedId = STATS_UNTRACKED_ID;
  readonly formatDuration = formatDurationMinutes;

  /** Tree with only tasks whose rolled-up time in the period is &gt; 0. */
  readonly statsFilteredTree = computed((): TaskTreeNode[] => {
    const s = this.summary();
    const tree = this.taskTree();
    if (!s) {
      return [];
    }
    const map = buildMinutesMap(s.byTask);
    return filterStatsTreeByPositiveTime(tree, map);
  });

  readonly pieNodes = computed((): PieNode[] => {
    const s = this.summary();
    const tree = this.statsFilteredTree();
    const expanded = this.expandedFolderIds();
    const showU = this.showUntracked();
    if (!s) {
      return [];
    }
    const map = buildMinutesMap(s.byTask);
    const slices = buildVisiblePieSlices(tree, expanded, map, { rootHueCounter: { n: 0 } }).filter(
      (x) => x.minutes > 0,
    );
    const out: PieNode[] = slices.map((sl) => ({
      taskId: sl.taskId,
      taskName: sl.taskName,
      minutes: sl.minutes,
      hue: sl.hue,
      shadeIndex: sl.shadeIndex,
      fillColor: sl.fillColor,
      isFolderSlice: sl.isExpandableFolder,
    }));
    if (showU && s.totals.untrackedMinutes > 0) {
      out.push({
        taskId: STATS_UNTRACKED_ID,
        taskName: 'Untracked',
        minutes: s.totals.untrackedMinutes,
        fillColor: STATS_UNTRACKED_SLICE_COLOR,
        isFolderSlice: false,
      });
    }
    return out;
  });

  readonly tableRows = computed(() => {
    const s = this.summary();
    const tree = this.statsFilteredTree();
    const expanded = this.expandedFolderIds();
    const showU = this.showUntracked();
    if (!s) {
      return [];
    }
    const map = buildMinutesMap(s.byTask);
    const slices = buildVisiblePieSlices(tree, expanded, map, { rootHueCounter: { n: 0 } }).filter(
      (x) => x.minutes > 0,
    );
    const sliceColors = buildTaskSliceColorMap(slices);
    const rows = buildStatsTableRows(tree, expanded, map, sliceColors, 0);
    if (showU && s.totals.untrackedMinutes > 0) {
      rows.push({
        taskId: STATS_UNTRACKED_ID,
        name: 'Untracked',
        minutes: s.totals.untrackedMinutes,
        depth: 0,
        isExpandable: false,
        isExpanded: false,
        sliceColor: STATS_UNTRACKED_SLICE_COLOR,
        showSliceColor: true,
      });
    }
    return rows;
  });

  readonly form = this.fb.nonNullable.group({
    from: [this.today, Validators.required],
    to: [this.today, Validators.required],
    idleHours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    if (this.form.invalid) {
      return;
    }
    const { from, to, idleHours } = this.form.getRawValue();
    forkJoin({
      summary: this.statsApi.getSummary(from, to, idleHours),
      tree: this.tasksApi.getTree(),
    }).subscribe(({ summary, tree }) => {
      this.summary.set(summary);
      this.taskTree.set(tree);
      this.expandedFolderIds.set(new Set());
    });
  }

  onShowUntrackedChange(ev: Event): void {
    const input = ev.target as HTMLInputElement;
    this.showUntracked.set(input.checked);
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

  onPieSegmentClick(taskId: string): void {
    if (taskId === STATS_UNTRACKED_ID) {
      return;
    }
    const node = findNodeInTree(this.statsFilteredTree(), taskId);
    if (
      !node ||
      node.trackerType !== TrackerType.SUBTASK ||
      node.children.length === 0
    ) {
      return;
    }
    this.toggleFolderExpand(taskId);
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
