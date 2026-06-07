import { isPlatformBrowser } from '@angular/common';
import {
  ApplicationConfig,
  PLATFORM_ID,
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
      const platformId = inject(PLATFORM_ID);
      if (!isPlatformBrowser(platformId)) {
        return;
      }

      const authApi = inject(AuthApiService);
      const settingsStore = inject(UserSettingsStore);
      const transloco = inject(TranslocoService);

      const user = await firstValueFrom(authApi.hydrateSession());

      if (user) {
        try {
          await firstValueFrom(settingsStore.hydrateFromServer());
        } catch {
          // settings load failure is non-fatal — defaults remain
        }
      } else {
        try {
          await firstValueFrom(transloco.load(transloco.getActiveLang()));
        } catch {
          // translation load failure is non-fatal — defaults remain
        }
      }
    }),
  ],
};
