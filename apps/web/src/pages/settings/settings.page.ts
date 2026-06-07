import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { debounceTime, distinctUntilChanged, skip } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { UserSettingsApiService } from '../../features/user-settings/model/user-settings-api.service';
import { UserSettingsStore } from '../../features/user-settings/model/user-settings.store';

const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ru', label: 'Russian' },
] as const;

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="mx-auto flex w-full max-w-xl flex-col gap-6 p-4">
      <div class="rounded-2xl bg-white p-6 shadow-sm">
        <h1 class="mb-6 text-2xl font-semibold text-slate-900">Settings</h1>

        <form [formGroup]="form" class="flex flex-col gap-6">
          <div class="flex flex-col gap-1.5">
            <label for="idleHours" class="text-sm font-medium text-slate-700">
              Idle hours per day
            </label>
            <p class="text-xs text-slate-500">
              Hours not attributed to any tracked task (used for untracked time in Stats).
            </p>
            <input
              id="idleHours"
              type="number"
              min="0"
              max="24"
              step="0.5"
              formControlName="idleHoursPerDay"
              class="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="language" class="text-sm font-medium text-slate-700">
              Interface language
            </label>
            <p class="text-xs text-slate-500">
              Language preference (UI language switching coming soon).
            </p>
            <select
              id="language"
              formControlName="language"
              class="w-48 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              @for (lang of languages; track lang.code) {
                <option [value]="lang.code">{{ lang.label }}</option>
              }
            </select>
          </div>

          <div class="h-4 text-xs">
            @if (saveStatus() === 'saving') {
              <span class="text-slate-400">Saving…</span>
            } @else if (saveStatus() === 'saved') {
              <span class="text-emerald-600">Saved</span>
            } @else if (saveStatus() === 'error') {
              <span class="text-red-500">Failed to save. Please try again.</span>
            }
          </div>
        </form>
      </div>
    </section>
  `,
})
export class SettingsPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(UserSettingsApiService);
  private readonly settingsStore = inject(UserSettingsStore);

  readonly languages = SUPPORTED_LANGUAGES;
  readonly saveStatus = signal<'idle' | 'saving' | 'saved' | 'error'>('idle');

  readonly form = this.fb.nonNullable.group({
    idleHoursPerDay: [0, [Validators.required, Validators.min(0), Validators.max(24)]],
    language: ['en', Validators.required],
  });

  constructor() {
    this.form.valueChanges
      .pipe(
        skip(1),
        debounceTime(600),
        distinctUntilChanged(
          (a, b) =>
            a.idleHoursPerDay === b.idleHoursPerDay && a.language === b.language,
        ),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.save());
  }

  ngOnInit(): void {
    if (this.settingsStore.isLoaded()) {
      this.form.setValue(
        {
          idleHoursPerDay: this.settingsStore.idleHoursPerDay(),
          language: this.settingsStore.language(),
        },
        { emitEvent: false },
      );
    } else {
      this.api.getSettings().subscribe((s) => {
        this.settingsStore.setIdleHoursPerDay(s.idleHoursPerDay);
        this.settingsStore.setLanguage(s.language);
        this.form.setValue(
          { idleHoursPerDay: s.idleHoursPerDay, language: s.language },
          { emitEvent: false },
        );
      });
    }
  }

  private save(): void {
    if (this.form.invalid) return;
    const { idleHoursPerDay, language } = this.form.getRawValue();
    this.saveStatus.set('saving');
    this.api.updateSettings({ idleHoursPerDay, language }).subscribe({
      next: (s) => {
        this.settingsStore.setIdleHoursPerDay(s.idleHoursPerDay);
        this.settingsStore.setLanguage(s.language);
        this.saveStatus.set('saved');
        setTimeout(() => {
          if (this.saveStatus() === 'saved') {
            this.saveStatus.set('idle');
          }
        }, 2000);
      },
      error: () => {
        this.saveStatus.set('error');
      },
    });
  }
}
