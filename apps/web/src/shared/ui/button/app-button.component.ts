import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TuiButton } from '@taiga-ui/core/components/button';

@Component({
  selector: 'app-button',
  standalone: true,
  imports: [CommonModule, TuiButton],
  template: `
    <button
      tuiButton
      [type]="type"
      [appearance]="appearance"
      [size]="size"
      [disabled]="disabled || loading"
      class="inline-flex items-center gap-2"
    >
      <span
        *ngIf="loading"
        class="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
      ></span>
      <ng-content />
    </button>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppButtonComponent {
  @Input() appearance = 'primary';
  @Input() size: 's' | 'm' | 'l' | 'xl' | 'xs' = 'm';
  @Input() type: 'button' | 'submit' | 'reset' = 'button';
  @Input() disabled = false;
  @Input() loading = false;
}
