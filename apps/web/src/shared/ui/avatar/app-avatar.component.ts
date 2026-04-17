import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TuiAvatar } from '@taiga-ui/kit/components/avatar';

@Component({
  selector: 'app-avatar',
  standalone: true,
  imports: [CommonModule, TuiAvatar],
  template: `
    <span
      tuiAvatar
      [size]="size"
      [appearance]="appearance"
      [tuiAvatar]="avatarCode"
      class="inline-flex"
    >
      {{ fallbackText }}
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppAvatarComponent {
  @Input() size: 'xs' | 's' | 'm' | 'l' | 'xl' | 'xxl' = 's';
  @Input() appearance = 'outline';
  @Input() avatarCode = '@tui.circle-user';
  @Input() fallbackText = 'T';
}
