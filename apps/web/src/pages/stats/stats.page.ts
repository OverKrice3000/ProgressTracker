import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { StatsApiService, StatsResponse } from '../../features/stats/model/stats-api.service';
import {
  DrilldownPieComponent,
  PieNode,
} from '../../widgets/stats/ui/drilldown-pie.component';
import { AppButtonComponent } from '../../shared/ui/button/app-button.component';

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
              Idle hours
              <input
                type="number"
                min="0"
                max="24"
                formControlName="idleHours"
                class="w-24 rounded border border-slate-300 p-2"
              />
            </label>
            <app-button type="submit">Refresh</app-button>
          </form>
        </div>
      </div>

      <div *ngIf="summary() as value" class="rounded-2xl bg-white p-5 shadow-sm">
        <div class="space-y-2">
          <p class="text-sm text-slate-700">
            <span class="font-medium">Total time logged (period):</span> {{ value.totals.loggedMinutes }}m
          </p>
          <p class="text-sm text-slate-600">
            24h breakdown: Logged {{ value.totals.loggedMinutes }}m, Idle {{ value.totals.idleMinutes }}m, Untracked
            {{ value.totals.untrackedMinutes }}m
          </p>
        </div>
      </div>

      @defer {
        <app-drilldown-pie [nodes]="pieNodes()" (segmentClick)="drillDown($event)" />
      } @placeholder {
        <p class="text-sm text-slate-500">Loading chart...</p>
      }

      <div *ngIf="summary() as s" class="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
        <div class="space-y-4">
          <h2 class="text-lg font-semibold text-slate-900">Tasks with logs in period</h2>
          <p *ngIf="s.byTask.length === 0" class="text-sm text-slate-500">
            No tasks had progress logged in this date range.
          </p>
          <table *ngIf="s.byTask.length > 0" class="w-full min-w-[28rem] border-collapse text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-slate-600">
                <th class="py-2 pr-4 font-medium">Task</th>
                <th class="py-2 pr-4 font-medium">Time logged (period)</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let row of s.byTask" class="border-b border-slate-100">
                <td class="py-2 pr-4">
                  <a [routerLink]="['/task', row.taskId]" class="font-medium text-blue-600 hover:underline">
                    {{ row.taskName }}
                  </a>
                </td>
                <td class="py-2 pr-4">{{ row.minutes }}m</td>
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
  private readonly today = this.formatLocalDate(new Date());

  readonly summary = signal<StatsResponse | null>(null);
  readonly pieNodes = signal<PieNode[]>([]);
  private readonly untrackedNodeId = '__untracked__';

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
    this.statsApi.getSummary(from, to, idleHours).subscribe((summary) => {
      this.summary.set(summary);
      this.pieNodes.set(this.buildPieNodes(summary));
    });
  }

  drillDown(taskId: string): void {
    const current = this.pieNodes();
    if (current.length === 0) {
      return;
    }
    const filtered = current.filter((entry) => entry.taskId === taskId);
    this.pieNodes.set(filtered.length > 0 ? filtered : current);
  }

  private formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private buildPieNodes(summary: StatsResponse): PieNode[] {
    const nodes: PieNode[] = [...summary.byTask];
    if (summary.totals.untrackedMinutes > 0) {
      nodes.push({
        taskId: this.untrackedNodeId,
        taskName: 'Untracked',
        minutes: summary.totals.untrackedMinutes,
      });
    }
    return nodes;
  }
}
