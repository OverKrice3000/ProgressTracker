import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TaskBase } from '../../../entities/task/model/task.types';
import { TaskAvatarComponent } from '../../../entities/task/ui/task-avatar.component';
import { TaskStatusBadgeComponent } from '../../../entities/task/ui/task-status-badge.component';
import { AppButtonComponent } from '../../../shared/ui/button/app-button.component';

@Component({
  selector: 'app-task-list-view',
  standalone: true,
  imports: [CommonModule, RouterLink, TaskAvatarComponent, TaskStatusBadgeComponent, AppButtonComponent],
  template: `
    <ul class="grid gap-3">
      <li
        *ngFor="let task of tasks"
        class="grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-xl bg-white p-3 shadow-sm"
      >
        <app-task-avatar [avatarUrl]="task.avatarUrl" [taskName]="task.name" />

        <div class="min-w-0">
          <a [routerLink]="['/task', task.id]" class="truncate text-sm font-semibold text-slate-900">
            {{ task.name }}
          </a>
          <p class="truncate text-xs text-slate-500">
            {{ task.trackerType }} • depth {{ task.depth }}
          </p>
        </div>

        <div class="flex items-center gap-2">
          <app-task-status-badge [isCompleted]="task.isCompleted" />
          <app-button appearance="outline-grayscale" size="s" (click)="createChild.emit(task)">
            Create child
          </app-button>
        </div>
      </li>
    </ul>
  `,
})
export class TaskListViewComponent {
  @Input({ required: true }) tasks: TaskBase[] = [];
  @Output() createChild = new EventEmitter<TaskBase>();
}
