import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskBase } from '../../../entities/task/model/task.types';

@Component({
  selector: 'app-task-list-view',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <ul class="task-list">
      <li *ngFor="let task of tasks">
        <a [routerLink]="['/task', task.id]">{{ task.name }}</a>
        <span>({{ task.trackerType }})</span>
        <span>Depth: {{ task.depth }}</span>
        <span>{{ task.isCompleted ? 'Completed' : 'In progress' }}</span>
        <button (click)="createChild.emit(task)">Create child</button>
      </li>
    </ul>
  `,
})
export class TaskListViewComponent {
  @Input({ required: true }) tasks: TaskBase[] = [];
  @Output() createChild = new EventEmitter<TaskBase>();
}
