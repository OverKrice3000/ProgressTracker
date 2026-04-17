import { mergeApplicationConfig, ApplicationConfig, signal, type WritableSignal } from '@angular/core';
import { provideServerRendering, withRoutes } from '@angular/ssr';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { TUI_DARK_MODE } from '@taiga-ui/core/tokens';
import { appConfig } from './app.config';
import { serverRoutes } from './app.routes.server';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering(withRoutes(serverRoutes)),
    provideNoopAnimations(),
    {
      provide: TUI_DARK_MODE,
      useFactory: (): WritableSignal<boolean> & { reset(): void } => {
        const state = signal(false) as WritableSignal<boolean> & { reset(): void };
        state.reset = () => state.set(false);
        return state;
      },
    },
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);
