import { CommonModule } from '@angular/common';
import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, inject, signal } from '@angular/core';

@Component({
  selector: 'app-task-actions-menu',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative">
      <button
        type="button"
        class="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
        aria-label="Open task actions"
        [attr.aria-expanded]="menuOpen()"
        (click)="toggleMenu($event)"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="5" r="1.8"></circle>
          <circle cx="12" cy="12" r="1.8"></circle>
          <circle cx="12" cy="19" r="1.8"></circle>
        </svg>
      </button>

      <div
        *ngIf="menuOpen()"
        class="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
      >
        <button
          type="button"
          class="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
          (click)="handleEdit($event)"
        >
          Edit task
        </button>
        <button
          *ngIf="showLogProgressOption"
          type="button"
          class="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 disabled:hover:bg-transparent"
          [disabled]="!canLogProgress"
          (click)="handleLogProgress($event)"
        >
          Log progress
        </button>
      </div>
    </div>
  `,
})
export class TaskActionsMenuComponent implements OnInit, OnDestroy {
  private readonly document = inject(DOCUMENT);
  private readonly host = inject(ElementRef<HTMLElement>);
  private detachOutsidePointerDown?: () => void;

  @Input() canLogProgress = true;
  @Input() showLogProgressOption = true;

  @Output() editTask = new EventEmitter<void>();
  @Output() logProgress = new EventEmitter<void>();

  readonly menuOpen = signal(false);

  toggleMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen.update((v) => !v);
  }

  ngOnInit(): void {
    const handler = (event: Event) => this.onDocumentPointerDown(event);
    this.document.addEventListener('pointerdown', handler, true);
    this.detachOutsidePointerDown = () => this.document.removeEventListener('pointerdown', handler, true);
  }

  ngOnDestroy(): void {
    this.detachOutsidePointerDown?.();
  }

  private onDocumentPointerDown(event: Event): void {
    if (!this.menuOpen()) {
      return;
    }
    const target = event.target as Node | null;
    if (target && this.host.nativeElement.contains(target)) {
      return;
    }
    this.menuOpen.set(false);
  }

  handleEdit(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.menuOpen.set(false);
    this.editTask.emit();
  }

  handleLogProgress(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (!this.canLogProgress) {
      return;
    }
    this.menuOpen.set(false);
    this.logProgress.emit();
  }
}
