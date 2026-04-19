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
import { formatDurationMinutes } from '../../../shared/lib/format-duration';
import { colorForStatsSlice } from '../../../shared/lib/stats-slice-color';

export interface PieNode {
  taskId: string;
  taskName: string;
  minutes: number;
  /** Stats page sets deterministic #hex per taskId; Untracked uses neutral grey. */
  fillColor?: string;
  /** Only folder slices receive hover, tooltip, and pointer cursor (drill-down). */
  isFolderSlice?: boolean;
}

interface PieSegment {
  taskId: string;
  path: string;
  color: string;
  isFullCircle?: boolean;
  title: string;
  interactive: boolean;
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
          <div class="flex flex-col items-center gap-5">
            <svg
              [attr.viewBox]="viewBox"
              class="mx-auto h-[min(28rem,90vw)] w-full max-w-2xl"
              role="img"
              [attr.aria-label]="chartAriaLabel()"
            >
              <g [attr.transform]="'translate(' + cx + ',' + cy + ')'">
                @for (seg of segments(); track seg.taskId) {
                  @if (seg.isFullCircle) {
                    <circle
                      [attr.r]="r"
                      [attr.fill]="seg.color"
                      stroke="#fff"
                      stroke-width="2"
                      [class.pointer-events-none]="!seg.interactive"
                      [class.cursor-pointer]="seg.interactive"
                      [class.hover:opacity-90]="seg.interactive"
                      (click)="seg.interactive && segmentClick.emit(seg.taskId)"
                    >
                      @if (seg.interactive) {
                        <title>{{ seg.title }}</title>
                      }
                    </circle>
                  } @else {
                    <path
                      [attr.d]="seg.path"
                      [attr.fill]="seg.color"
                      stroke="#fff"
                      stroke-width="2"
                      [class.pointer-events-none]="!seg.interactive"
                      [class.cursor-pointer]="seg.interactive"
                      [class.hover:opacity-90]="seg.interactive"
                      (click)="seg.interactive && segmentClick.emit(seg.taskId)"
                    >
                      @if (seg.interactive) {
                        <title>{{ seg.title }}</title>
                      }
                    </path>
                  }
                }
              </g>
            </svg>
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

  readonly cx = 200;
  readonly cy = 200;
  readonly r = 170;
  readonly viewBox = '0 0 400 400';

  readonly totalMinutes = signal(0);
  readonly segments = signal<PieSegment[]>([]);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['nodes']) {
      this.recompute();
    }
  }

  chartAriaLabel(): string {
    const t = this.totalMinutes();
    if (t <= 0) {
      return 'No data';
    }
    return `Time distribution, total ${formatDurationMinutes(t)}`;
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
      const color = colorForStatsSlice(node, i);
      const interactive = node.isFolderSlice === true;
      const title = `${node.taskName}: ${formatDurationMinutes(node.minutes)}`;
      segs.push({
        taskId: node.taskId,
        path,
        color,
        isFullCircle,
        title,
        interactive,
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
