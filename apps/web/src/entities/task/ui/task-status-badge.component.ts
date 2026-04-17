import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AppBadgeComponent } from '../../../shared/ui/badge/app-badge.component';

@Component({
  selector: 'app-task-status-badge',
  standalone: true,
  imports: [CommonModule, AppBadgeComponent],
  template: `
    <app-badge
      [text]="isCompleted ? 'Completed' : 'In progress'"
      [appearance]="isCompleted ? 'positive' : 'warning'"
      size="s"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskStatusBadgeComponent {
  @Input() isCompleted = false;
}
