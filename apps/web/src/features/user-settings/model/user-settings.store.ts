import { Injectable, computed, inject, signal } from '@angular/core';
import { UserSettingsApiService } from './user-settings-api.service';

@Injectable({ providedIn: 'root' })
export class UserSettingsStore {
  private readonly api = inject(UserSettingsApiService);

  private readonly idleHoursPerDaySignal = signal(0);
  private readonly languageSignal = signal('en');
  private readonly loadedSignal = signal(false);
  private loading = false;

  readonly idleHoursPerDay = computed(() => this.idleHoursPerDaySignal());
  readonly language = computed(() => this.languageSignal());
  readonly isLoaded = computed(() => this.loadedSignal());

  load(): void {
    if (this.loadedSignal() || this.loading) return;
    this.loading = true;
    this.api.getSettings().subscribe((s) => {
      this.idleHoursPerDaySignal.set(s.idleHoursPerDay);
      this.languageSignal.set(s.language);
      this.loadedSignal.set(true);
    });
  }

  setIdleHoursPerDay(value: number): void {
    this.idleHoursPerDaySignal.set(value);
  }

  setLanguage(value: string): void {
    this.languageSignal.set(value);
  }
}
