import { CommonModule } from '@angular/common';
import { Component, DOCUMENT, ElementRef, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TrackerType } from '@progress-tracker/contracts';
import { TuiDialogService } from '@taiga-ui/core/portals/dialog';
import { PolymorpheusComponent } from '@taiga-ui/polymorpheus';
import { ProgressLogsApiService, ProgressLogListItem } from '../../features/progress-logs/model/progress-logs-api.service';
import {
  EditProgressLogDialogComponent,
  EditProgressLogDialogData,
} from '../../features/progress-logs/ui/edit-progress-log-dialog.component';
import { TaskTreeRefreshService } from '../../features/tasks/model/task-tree-refresh.service';
import { formatYmdAsReadable } from '../../shared/lib/local-day-bounds';
import { formatHoursMinutesShort } from '../../shared/lib/format-hours-minutes';
import { AppButtonComponent } from '../../shared/ui/button/app-button.component';
import {
  ConfirmActionDialogComponent,
  ConfirmActionDialogData,
} from '../../shared/ui/modal/confirm-action-dialog.component';

interface DayGroup {
  ymd: string;
  label: string;
  entries: ProgressLogListItem[];
}

@Component({
  selector: 'app-logs-page',
  standalone: true,
  imports: [CommonModule, RouterLink, AppButtonComponent],
  template: `
    <section class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <div class="rounded-2xl bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <h1 class="text-2xl font-semibold text-slate-900">Progress logs</h1>
          <app-button appearance="outline-grayscale" type="button" (click)="reload()">Refresh</app-button>
        </div>
        <p class="mt-2 text-sm text-slate-600">
          Audit trail of progress entries. Edit or delete to correct mistakes; task totals replay from remaining
          logs.
        </p>
      </div>

      <div *ngIf="loadError()" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
        {{ loadError() }}
      </div>

      <div *ngIf="loading()" class="text-sm text-slate-600">Loading…</div>

      <div *ngIf="!loading() && !loadError() && groups().length === 0" class="text-sm text-slate-600">
        No progress logs yet.
      </div>

      <div *ngFor="let g of groups()" class="rounded-2xl bg-white p-5 shadow-sm">
        <h2 class="mb-4 text-lg font-semibold text-slate-900">{{ g.label }}</h2>
        <ul class="divide-y divide-slate-100">
          <li *ngFor="let log of g.entries" class="flex flex-wrap items-start justify-between gap-3 py-4 first:pt-0">
            <div class="min-w-0 flex-1">
              <a
                [routerLink]="['/task', log.taskId]"
                class="font-medium text-blue-700 hover:underline"
              >
                {{ log.taskName }}
              </a>
              <p class="mt-1 text-sm text-slate-700">{{ formatLogSummary(log) }}</p>
              <p class="mt-0.5 text-xs text-slate-500">Logged {{ formatTime(log.createdAt) }}</p>
            </div>
            <div class="relative shrink-0">
              <button
                type="button"
                class="flex h-8 w-8 items-center justify-center rounded-md text-slate-600 hover:bg-slate-100"
                [attr.aria-expanded]="menuOpenId() === log.id"
                [attr.aria-label]="'Actions for log ' + log.id"
                (click)="toggleMenu($event, log.id)"
              >
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="12" cy="5" r="1.8"></circle>
                  <circle cx="12" cy="12" r="1.8"></circle>
                  <circle cx="12" cy="19" r="1.8"></circle>
                </svg>
              </button>
              <div
                *ngIf="menuOpenId() === log.id"
                class="absolute right-0 z-20 mt-2 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-sm"
              >
                <button
                  type="button"
                  class="block w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                  (click)="openEdit(log); closeMenu()"
                >
                  Edit
                </button>
                <button
                  type="button"
                  class="block w-full rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50"
                  (click)="confirmDelete(log); closeMenu()"
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </section>
  `,
})
export class LogsPage implements OnInit {
  private readonly progressLogsApi = inject(ProgressLogsApiService);
  private readonly dialogs = inject(TuiDialogService);
  private readonly taskTreeRefresh = inject(TaskTreeRefreshService);
  private readonly document = inject(DOCUMENT);
  private readonly host = inject(ElementRef<HTMLElement>);
  readonly loading = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly groups = signal<DayGroup[]>([]);
  readonly menuOpenId = signal<string | null>(null);

  private detachOutside?: () => void;

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.progressLogsApi.list().subscribe({
      next: (rows) => {
        this.loading.set(false);
        this.groups.set(this.groupLogs(rows));
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set('Could not load progress logs.');
      },
    });
  }

  formatLogSummary(log: ProgressLogListItem): string {
    const applied = log.appliedTrackerMetadata ?? {};
    if (log.trackerType === TrackerType.TIME) {
      const session = formatHoursMinutesShort(log.timeSpentMinutes);
      const totalMin = Number((applied as Record<string, unknown>)['currentMinutes'] ?? 0);
      return `${session} this session · total ${formatHoursMinutesShort(totalMin)}`;
    }
    if (log.trackerType === TrackerType.NUMBER) {
      const cur = Number((applied as Record<string, unknown>)['current'] ?? 0);
      const total = Number((applied as Record<string, unknown>)['total'] ?? 0);
      return `${formatHoursMinutesShort(log.timeSpentMinutes)} this session · progress ${cur} / ${total}`;
    }
    if (log.trackerType === TrackerType.BOOLEAN) {
      const done = Boolean((applied as Record<string, unknown>)['current']);
      return `${formatHoursMinutesShort(log.timeSpentMinutes)} · ${done ? 'Marked complete' : 'Not complete'}`;
    }
    return `${formatHoursMinutesShort(log.timeSpentMinutes)}`;
  }

  formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  toggleMenu(event: MouseEvent, logId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.teardownMenuOutside();
    if (this.menuOpenId() === logId) {
      this.menuOpenId.set(null);
      return;
    }
    this.menuOpenId.set(logId);
    queueMicrotask(() => this.attachMenuOutside());
  }

  closeMenu(): void {
    this.menuOpenId.set(null);
    this.teardownMenuOutside();
  }

  private attachMenuOutside(): void {
    const handler = (e: PointerEvent) => {
      const path = e.composedPath();
      if (path.includes(this.host.nativeElement)) {
        return;
      }
      this.menuOpenId.set(null);
      this.teardownMenuOutside();
    };
    this.document.addEventListener('pointerdown', handler, true);
    this.detachOutside = () => this.document.removeEventListener('pointerdown', handler, true);
  }

  private teardownMenuOutside(): void {
    this.detachOutside?.();
    this.detachOutside = undefined;
  }

  openEdit(log: ProgressLogListItem): void {
    const data: EditProgressLogDialogData = { log };
    this.dialogs
      .open<void>(new PolymorpheusComponent(EditProgressLogDialogComponent), {
        label: 'Edit progress log',
        data,
      })
      .subscribe(() => this.reload());
  }

  confirmDelete(log: ProgressLogListItem): void {
    const dialogData: ConfirmActionDialogData = {
      message: `Delete this progress entry for “${log.taskName}”? Task progress will be recalculated from remaining logs.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      danger: true,
    };
    this.dialogs
      .open<boolean>(new PolymorpheusComponent(ConfirmActionDialogComponent), {
        label: 'Delete log',
        data: dialogData,
      })
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.progressLogsApi.deleteLog(log.taskId, log.id).subscribe({
          next: () => {
            this.taskTreeRefresh.notifyProgressChanged();
            this.reload();
          },
          error: () => {
            this.loadError.set('Could not delete log.');
          },
        });
      });
  }

  private groupLogs(rows: ProgressLogListItem[]): DayGroup[] {
    const byDay = new Map<string, ProgressLogListItem[]>();
    for (const row of rows) {
      const list = byDay.get(row.loggedDateYmd) ?? [];
      list.push(row);
      byDay.set(row.loggedDateYmd, list);
    }
    const ymds = [...byDay.keys()].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
    return ymds.map((ymd) => {
      const entries = byDay.get(ymd) ?? [];
      entries.sort((a, b) => (a.createdAt > b.createdAt ? -1 : a.createdAt < b.createdAt ? 1 : 0));
      return {
        ymd,
        label: formatYmdAsReadable(ymd),
        entries,
      };
    });
  }
}
