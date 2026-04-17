import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TuiBadge } from '@taiga-ui/kit/components/badge';

@Component({
  selector: 'app-badge',
  standalone: true,
  imports: [CommonModule, TuiBadge],
  template: `
    <span tuiBadge [appearance]="appearance" [size]="size" class="inline-flex items-center">
      {{ text }}
    </span>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppBadgeComponent {
  @Input({ required: true }) text!: string;
  @Input() appearance = 'primary';
  @Input() size: 's' | 'm' | 'l' | 'xl' = 's';
}
