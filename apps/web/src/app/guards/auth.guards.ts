import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserStore } from '../../entities/user/model/user.store';

export const authGuard: CanActivateFn = () => {
  const store = inject(UserStore);
  const router = inject(Router);
  if (store.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree(['/login']);
};

export const loginRedirectGuard: CanActivateFn = () => {
  const store = inject(UserStore);
  const router = inject(Router);
  if (store.isAuthenticated()) {
    return router.createUrlTree(['/dashboard']);
  }
  return true;
};
