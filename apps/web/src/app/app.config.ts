import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withEnabledBlockingInitialNavigation } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { firstValueFrom } from 'rxjs';
import { provideTaiga } from '@taiga-ui/core';
import { AuthApiService } from '../features/auth/model/auth-api.service';
import { provideTransloco, TranslocoService } from '@jsverse/transloco';
import { UserSettingsApiService } from '../features/user-settings/model/user-settings-api.service';
import { UserSettingsStore } from '../features/user-settings/model/user-settings.store';
import { TranslocoHttpLoader } from './transloco-loader';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withEnabledBlockingInitialNavigation()),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch()),
    provideAnimations(),
    provideTaiga({ fontScaling: false }),
    provideTransloco({
      config: {
        availableLangs: ['en', 'ru'],
        defaultLang: 'en',
        reRenderOnLangChange: true,
        prodMode: true,
      },
      loader: TranslocoHttpLoader,
    }),
    provideAppInitializer(async () => {
      const authApi = inject(AuthApiService);
      const settingsApi = inject(UserSettingsApiService);
      const settingsStore = inject(UserSettingsStore);
      const transloco = inject(TranslocoService);

      const user = await firstValueFrom(authApi.hydrateSession());

      if (user) {
        try {
          const settings = await firstValueFrom(settingsApi.getSettings());
          settingsStore.setIdleHoursPerDay(settings.idleHoursPerDay);
          settingsStore.setLanguage(settings.language);
          settingsStore.markLoaded();
          transloco.setActiveLang(settings.language);
        } catch {
          // settings load failure is non-fatal — defaults remain
        }
      }

      await firstValueFrom(transloco.load(transloco.getActiveLang()));
    }),
  ],
};
