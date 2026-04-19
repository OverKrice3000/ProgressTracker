import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  signal,
} from '@angular/core';

export interface PieNode {
  taskId: string;
  taskName: string;
  minutes: number;
}

interface PieSegment {
  taskId: string;
  path: string;
  color: string;
  isFullCircle?: boolean;
}

@Component({
  selector: 'app-drilldown-pie',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="rounded-2xl bg-white p-5 shadow-sm">
      <div class="space-y-5">
      <h3 class="text-lg font-semibold text-slate-900">Time by task</h3>
      <ng-container *ngIf="nodes.length && totalMinutes() > 0; else empty">
        <div class="flex flex-col gap-5">
        <svg [attr.viewBox]="viewBox" class="mx-auto h-64 w-full max-w-md">
          <g [attr.transform]="'translate(' + cx + ',' + cy + ')'">
            @for (seg of segments(); track seg.taskId) {
              @if (seg.isFullCircle) {
                <circle
                  [attr.r]="r"
                  [attr.fill]="seg.color"
                  stroke="#fff"
                  stroke-width="1"
                  class="cursor-pointer hover:opacity-90"
                  (click)="segmentClick.emit(seg.taskId)"
                />
              } @else {
                <path
                  [attr.d]="seg.path"
                  [attr.fill]="seg.color"
                  stroke="#fff"
                  stroke-width="1"
                  class="cursor-pointer hover:opacity-90"
                  (click)="segmentClick.emit(seg.taskId)"
                />
              }
            }
          </g>
        </svg>
        <ul class="space-y-2 text-sm text-slate-600">
          <li *ngFor="let node of nodes" class="flex justify-between gap-3">
            <span class="truncate">{{ node.taskName }}</span>
            <span class="shrink-0 font-medium">{{ node.minutes }}m</span>
          </li>
        </ul>
        </div>
      </ng-container>
      <ng-template #empty>
        <p class="text-sm text-slate-500">No logged time in this selection.</p>
      </ng-template>
      </div>
    </div>
  `,
})
export class DrilldownPieComponent implements OnChanges {
  @Input({ required: true }) nodes: PieNode[] = [];
  @Output() segmentClick = new EventEmitter<string>();

  readonly cx = 100;
  readonly cy = 100;
  readonly r = 90;
  readonly viewBox = '0 0 200 200';

  readonly totalMinutes = signal(0);
  readonly segments = signal<PieSegment[]>([]);

  private readonly colors = [
    '#3b82f6',
    '#6366f1',
    '#8b5cf6',
    '#a855f7',
    '#d946ef',
    '#f97316',
    '#eab308',
    '#22c55e',
  ];

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodes']) {
      this.recompute();
    }
  }

  private recompute(): void {
    const epsilon = 1e-6;
    const total = this.nodes.reduce((sum, n) => sum + n.minutes, 0);
    this.totalMinutes.set(total);
    if (total <= 0 || this.nodes.length === 0) {
      this.segments.set([]);
      return;
    }
    let angle = -Math.PI / 2;
    const segs: PieSegment[] = [];
    this.nodes.forEach((node, i) => {
      const sweep = (node.minutes / total) * 2 * Math.PI;
      const isFullCircle = sweep >= 2 * Math.PI - epsilon;
      const path = this.slicePath(this.r, angle, angle + sweep);
      segs.push({
        taskId: node.taskId,
        path,
        color: this.colors[i % this.colors.length],
        isFullCircle,
      });
      angle += sweep;
    });
    this.segments.set(segs);
  }

  /** Pie slice from center, angles in radians, SVG coordinates (y down). */
  private slicePath(radius: number, a0: number, a1: number): string {
    const x0 = radius * Math.cos(a0);
    const y0 = radius * Math.sin(a0);
    const x1 = radius * Math.cos(a1);
    const y1 = radius * Math.sin(a1);
    const largeArc = a1 - a0 > Math.PI ? 1 : 0;
    return `M 0 0 L ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z`;
  }
}
