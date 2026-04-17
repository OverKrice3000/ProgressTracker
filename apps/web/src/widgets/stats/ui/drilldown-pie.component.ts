import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface PieNode {
  taskId: string;
  taskName: string;
  minutes: number;
}

@Component({
  selector: 'app-drilldown-pie',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pie-widget">
      <h3>Drill-down Pie (table fallback)</h3>
      <ul>
        <li *ngFor="let node of nodes">
          <button (click)="segmentClick.emit(node.taskId)">
            {{ node.taskName }} - {{ node.minutes }}m
          </button>
        </li>
      </ul>
    </div>
  `,
})
export class DrilldownPieComponent {
  @Input({ required: true }) nodes: PieNode[] = [];
  @Output() segmentClick = new EventEmitter<string>();
}
