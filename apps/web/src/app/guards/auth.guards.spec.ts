import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { authGuard, loginRedirectGuard } from './auth.guards';
import { AuthApiService } from '../../features/auth/model/auth-api.service';

describe('Auth guards', () => {
  const routerStub = {
    createUrlTree: (commands: string[]) =>
      ({ commands } as unknown) as ReturnType<Router['createUrlTree']>,
  };

  it('authGuard allows authenticated user', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerStub },
        {
          provide: AuthApiService,
          useValue: {
            hydrateSession: () => of({ userId: 'u1', username: 'demo' }),
          },
        },
      ],
    });
    const out = await firstValueFrom(
      TestBed.runInInjectionContext(() => authGuard({} as never, {} as never)) as import('rxjs').Observable<
        boolean | ReturnType<Router['createUrlTree']>
      >,
    );
    expect(out).toBe(true);
  });

  it('loginRedirectGuard redirects authenticated user to dashboard', async () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: routerStub },
        {
          provide: AuthApiService,
          useValue: {
            hydrateSession: () => of({ userId: 'u1', username: 'demo' }),
          },
        },
      ],
    });
    const out = await firstValueFrom(
      TestBed.runInInjectionContext(() =>
        loginRedirectGuard({} as never, {} as never),
      ) as import('rxjs').Observable<boolean | ReturnType<Router['createUrlTree']>>,
    );
    expect(out).toEqual(routerStub.createUrlTree(['/dashboard']));
  });
});
