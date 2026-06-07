import { Injectable, computed, inject, signal } from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { Observable, map, switchMap, tap } from 'rxjs';
import { UserSettings, UserSettingsApiService } from './user-settings-api.service';

@Injectable({ providedIn: 'root' })
export class UserSettingsStore {
  private readonly api = inject(UserSettingsApiService);
  private readonly transloco = inject(TranslocoService);

  private readonly idleHoursPerDaySignal = signal(0);
  private readonly languageSignal = signal('en');
  private readonly loadedSignal = signal(false);
  private loading = false;

  readonly idleHoursPerDay = computed(() => this.idleHoursPerDaySignal());
  readonly language = computed(() => this.languageSignal());
  readonly isLoaded = computed(() => this.loadedSignal());

  hydrateFromServer(): Observable<UserSettings> {
    return this.api.getSettings().pipe(
      tap((s) => {
        this.idleHoursPerDaySignal.set(s.idleHoursPerDay);
        this.languageSignal.set(s.language);
        this.loadedSignal.set(true);
        this.loading = true;
        this.transloco.setActiveLang(s.language);
      }),
      switchMap((s) => this.transloco.load(s.language).pipe(map(() => s))),
    );
  }

  load(): void {
    if (this.loadedSignal() || this.loading) return;
    this.loading = true;
    this.api.getSettings().subscribe((s) => {
      this.idleHoursPerDaySignal.set(s.idleHoursPerDay);
      this.languageSignal.set(s.language);
      this.loadedSignal.set(true);
    });
  }

  markLoaded(): void {
    this.loadedSignal.set(true);
    this.loading = true;
  }

  setIdleHoursPerDay(value: number): void {
    this.idleHoursPerDaySignal.set(value);
  }

  setLanguage(value: string): void {
    this.languageSignal.set(value);
  }
}
