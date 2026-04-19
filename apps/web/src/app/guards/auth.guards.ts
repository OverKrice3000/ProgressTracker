import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map, take } from 'rxjs';
import { AuthApiService } from '../../features/auth/model/auth-api.service';

/**
 * Waits for `GET /api/auth/me` (via shared cached observable) before choosing a route.
 *
 * On **SSR**, there is no browser session in our setup (`/me` resolves to null), which used to
 * redirect every protected URL to `/login` during server render, then the client would recover —
 * causing a login → dashboard flash on refresh. We defer the real check to the browser.
 */
export const authGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true;
  }
  const authApi = inject(AuthApiService);
  const router = inject(Router);
  return authApi.hydrateSession().pipe(
    take(1),
    map((user) => (user !== null ? true : router.createUrlTree(['/login']))),
  );
};

export const loginRedirectGuard: CanActivateFn = () => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true;
  }
  const authApi = inject(AuthApiService);
  const router = inject(Router);
  return authApi.hydrateSession().pipe(
    take(1),
    map((user) => (user !== null ? router.createUrlTree(['/dashboard']) : true)),
  );
};
