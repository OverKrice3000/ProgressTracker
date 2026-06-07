import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { POLYMORPHEUS_CONTEXT } from '@taiga-ui/polymorpheus';
import type { TuiDialogContext } from '@taiga-ui/core/portals/dialog';
import { AppButtonComponent } from '../button/app-button.component';

export interface ConfirmActionDialogData {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

@Component({
  selector: 'app-confirm-action-dialog',
  standalone: true,
  imports: [CommonModule, AppButtonComponent, TranslocoPipe],
  template: `
    <div class="grid gap-4">
      <p class="text-sm text-slate-700">{{ context.data.message }}</p>
      <div class="flex justify-end gap-2">
        <app-button appearance="outline-grayscale" type="button" (click)="context.completeWith(false)">
          {{ context.data.cancelLabel ?? ('confirmDialog.cancel' | transloco) }}
        </app-button>
        <app-button [appearance]="context.data.danger ? 'primary' : 'primary'" type="button" (click)="context.completeWith(true)">
          {{ context.data.confirmLabel ?? ('confirmDialog.confirm' | transloco) }}
        </app-button>
      </div>
    </div>
  `,
})
export class ConfirmActionDialogComponent {
  readonly context = inject(POLYMORPHEUS_CONTEXT) as TuiDialogContext<boolean, ConfirmActionDialogData>;
}
