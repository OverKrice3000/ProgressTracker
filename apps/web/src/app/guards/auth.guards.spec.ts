import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard, loginRedirectGuard } from './auth.guards';
import { UserStore } from '../../entities/user/model/user.store';

describe('Auth guards', () => {
  let userStore: UserStore;
  const router = {
    createUrlTree: (commands: string[]) => commands.join('/'),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: router }],
    });
    userStore = TestBed.inject(UserStore);
  });

  it('authGuard redirects unauthenticated user to login', () => {
    userStore.clear();
    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBe('/login');
  });

  it('loginRedirectGuard redirects authenticated user to dashboard', () => {
    userStore.setUser({ userId: 'u1', username: 'demo' });
    const result = TestBed.runInInjectionContext(() =>
      loginRedirectGuard({} as never, {} as never),
    );
    expect(result).toBe('/dashboard');
  });
});
