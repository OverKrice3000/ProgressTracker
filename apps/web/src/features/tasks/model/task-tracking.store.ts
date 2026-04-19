import { Injectable, computed, inject, signal } from '@angular/core';
import {
  CurrentTrackingSession,
  StopTrackingResult,
  TasksApiService,
} from './tasks-api.service';

@Injectable({ providedIn: 'root' })
export class TaskTrackingStore {
  private readonly tasksApi = inject(TasksApiService);
  private readonly nowMs = signal(Date.now());
  private readonly ticker = setInterval(() => this.nowMs.set(Date.now()), 1_000);
  private readonly startedAtMs = signal<number | null>(null);

  readonly currentSession = signal<CurrentTrackingSession | null>(null);

  readonly elapsedSeconds = computed(() => {
    const now = this.nowMs();
    const startMs = this.startedAtMs();
    if (startMs === null) {
      return 0;
    }
    return this.calculateElapsedSecondsFromEpoch(startMs, now);
  });

  readonly elapsedMinutes = computed(() => {
    return Math.floor(this.elapsedSeconds() / 60);
  });

  /** Source-of-truth elapsed calculation based on UTC epoch milliseconds. */
  private calculateElapsedSecondsFromEpoch(startedAtEpochMs: number, nowEpochMs: number): number {
    const start = startedAtEpochMs;
    const now = nowEpochMs;
    const elapsedMs = now - start;
    const safeElapsedMs = Math.max(0, elapsedMs);
    const secondsTotal = Math.floor(safeElapsedMs / 1_000);
    const minutesTotal = Math.floor(secondsTotal / 60);
    if ((globalThis as { ngDevMode?: boolean }).ngDevMode) {
      // eslint-disable-next-line no-console
      console.log('Start MS:', start, 'Now MS:', now, 'Diff Mins:', minutesTotal);
    }
    return secondsTotal;
  }

  loadCurrent(): void {
    this.tasksApi.getCurrentTracking().subscribe((session) => {
      this.currentSession.set(session);
      this.startedAtMs.set(session ? session.startTimeMs : null);
      this.nowMs.set(Date.now());
    });
  }

  setCurrent(session: CurrentTrackingSession | null): void {
    this.currentSession.set(session);
    this.startedAtMs.set(session ? session.startTimeMs : null);
    this.nowMs.set(Date.now());
  }

  startTracking(taskId: string, stopExisting = false, onDone?: () => void): void {
    const startTimeMs = Date.now();
    this.tasksApi.startTracking({ taskId, startTimeMs, stopExisting }).subscribe((session) => {
      this.currentSession.set(session);
      this.startedAtMs.set(session.startTimeMs);
      this.nowMs.set(Date.now());
      onDone?.();
    });
  }

  stopTracking(onDone?: (result: StopTrackingResult) => void): void {
    this.tasksApi.stopTracking().subscribe((result) => {
      this.currentSession.set(null);
      this.startedAtMs.set(null);
      this.nowMs.set(Date.now());
      onDone?.(result);
    });
  }
}
