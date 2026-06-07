import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppBadgeComponent } from '../../../shared/ui/badge/app-badge.component';

@Component({
  selector: 'app-task-status-badge',
  standalone: true,
  imports: [CommonModule, AppBadgeComponent, TranslocoPipe],
  template: `
    <app-badge
      [text]="isCompleted ? ('taskStatus.completed' | transloco) : ('taskStatus.inProgress' | transloco)"
      [appearance]="isCompleted ? 'positive' : 'warning'"
      size="s"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskStatusBadgeComponent {
  @Input() isCompleted = false;
}
