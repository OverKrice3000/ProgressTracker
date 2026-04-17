import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-modal-shell',
  standalone: true,
  template: `
    <section class="grid gap-4 p-1">
      <header class="text-lg font-semibold">
        <ng-content select="[modal-title]" />
      </header>
      <div class="grid gap-3">
        <ng-content />
      </div>
      <footer class="flex justify-end gap-2">
        <ng-content select="[modal-actions]" />
      </footer>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppModalShellComponent {}
