import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { AppAvatarComponent } from '../../../shared/ui/avatar/app-avatar.component';

@Component({
  selector: 'app-task-avatar',
  standalone: true,
  imports: [CommonModule, AppAvatarComponent],
  template: `
    <app-avatar
      size="s"
      [avatarCode]="avatarCode"
      [fallbackText]="fallbackText"
      appearance="outline-grayscale"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TaskAvatarComponent {
  @Input() avatarUrl: string | null = null;
  @Input() taskName = '';

  get avatarCode(): string {
    // TuiAvatar consumes icon code. Keep url for future image implementation.
    void this.avatarUrl;
    return '@tui.circle-check';
  }

  get fallbackText(): string {
    return (this.taskName || 'T').slice(0, 1).toUpperCase();
  }
}
