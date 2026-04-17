import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TaskTreeNode } from '../../../entities/task/model/task.types';

@Component({
  selector: 'app-task-tree',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ul class="task-tree">
      <ng-container *ngFor="let node of nodes">
        <li>
          <details>
            <summary>{{ node.name }} (depth {{ node.depth }})</summary>
            <app-task-tree [nodes]="node.children" *ngIf="node.children.length > 0" />
          </details>
        </li>
      </ng-container>
    </ul>
  `,
})
export class TaskTreeComponent {
  @Input({ required: true }) nodes: TaskTreeNode[] = [];
}
