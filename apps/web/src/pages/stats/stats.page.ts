import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TaskTreeNode } from '../../entities/task/model/task.types';
import { StatsApiService, StatsResponse } from '../../features/stats/model/stats-api.service';
import { TasksApiService } from '../../features/tasks/model/tasks-api.service';
import {
  DrilldownPieComponent,
  PieNode,
} from '../../widgets/stats/ui/drilldown-pie.component';
import { TaskTreeComponent } from '../../widgets/stats/ui/task-tree.component';

@Component({
  selector: 'app-stats-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DrilldownPieComponent, TaskTreeComponent],
  template: `
    <section class="page">
      <h1>Stats</h1>
      <form [formGroup]="form" (ngSubmit)="load()">
        <label>
          From
          <input type="date" formControlName="from" />
        </label>
        <label>
          To
          <input type="date" formControlName="to" />
        </label>
        <label>
          Idle hours
          <input type="number" min="0" max="24" formControlName="idleHours" />
        </label>
        <button type="submit">Refresh</button>
      </form>

      <p *ngIf="summary() as value">
        24h breakdown: Logged {{ value.totals.loggedMinutes }}m, Idle {{ value.totals.idleMinutes }}m,
        Untracked {{ value.totals.untrackedMinutes }}m
      </p>

      @defer {
        <app-drilldown-pie [nodes]="pieNodes()" (segmentClick)="drillDown($event)" />
      } @placeholder {
        <p>Loading chart...</p>
      }

      @defer {
        <app-task-tree [nodes]="tree()" />
      } @placeholder {
        <p>Loading task tree...</p>
      }
    </section>
  `,
})
export class StatsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly statsApi = inject(StatsApiService);
  private readonly tasksApi = inject(TasksApiService);

  readonly summary = signal<StatsResponse | null>(null);
  readonly pieNodes = signal<PieNode[]>([]);
  readonly tree = signal<TaskTreeNode[]>([]);

  readonly form = this.fb.nonNullable.group({
    from: [new Date().toISOString().slice(0, 10), Validators.required],
    to: [new Date().toISOString().slice(0, 10), Validators.required],
    idleHours: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
  });

  ngOnInit(): void {
    this.load();
    this.tasksApi.getTree().subscribe((tree) => this.tree.set(tree));
  }

  load(): void {
    if (this.form.invalid) {
      return;
    }
    const { from, to, idleHours } = this.form.getRawValue();
    this.statsApi.getSummary(from, to, idleHours).subscribe((summary) => {
      this.summary.set(summary);
      this.pieNodes.set(summary.byTask);
    });
  }

  drillDown(taskId: string): void {
    const summary = this.summary();
    if (!summary) {
      return;
    }
    const filtered = summary.byTask.filter((entry) => entry.taskId === taskId);
    this.pieNodes.set(filtered.length > 0 ? filtered : summary.byTask);
  }
}
