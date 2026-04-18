import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { UserStore } from '../../entities/user/model/user.store';

export const authGuard: CanActivateFn = () => {
  const store = inject(UserStore);
  const router = inject(Router);
  return toObservable(store.isReady).pipe(
    filter((ready) => ready),
    take(1),
    map(() => (store.isAuthenticated() ? true : router.createUrlTree(['/login']))),
  );
};

export const loginRedirectGuard: CanActivateFn = () => {
  const store = inject(UserStore);
  const router = inject(Router);
  return toObservable(store.isReady).pipe(
    filter((ready) => ready),
    take(1),
    map(() => (store.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true)),
  );
};
