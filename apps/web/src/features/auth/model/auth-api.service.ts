import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, shareReplay, tap } from 'rxjs';
import { AuthUser, UserStore } from '../../../entities/user/model/user.store';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly userStore = inject(UserStore);
  private readonly platformId = inject(PLATFORM_ID);

  /** Single in-flight / replayed session fetch so guards and APP_INITIALIZER share one result. */
  private session$: Observable<AuthUser | null> | null = null;

  hydrateSession(): Observable<AuthUser | null> {
    if (!this.session$) {
      this.session$ = this.fetchMe().pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.session$;
  }

  private fetchMe(): Observable<AuthUser | null> {
    if (!isPlatformBrowser(this.platformId)) {
      this.userStore.setUser(null);
      return of(null);
    }
    return this.http.get<AuthUser>('api/auth/me', { withCredentials: true }).pipe(
      tap((user) => this.userStore.setUser(user)),
      catchError(() => {
        this.userStore.setUser(null);
        return of(null);
      }),
    );
  }

  private resetSessionCache(): void {
    this.session$ = null;
  }

  login(username: string, password: string): Observable<AuthUser> {
    return this.http
      .post<AuthUser>(
        'api/auth/login',
        { username, password },
        { withCredentials: true },
      )
      .pipe(
        tap((user) => {
          this.userStore.setUser(user);
          this.session$ = of(user).pipe(shareReplay({ bufferSize: 1, refCount: false }));
        }),
      );
  }

  logout(): Observable<void> {
    return this.http.post<{ ok: true }>('api/auth/logout', {}, { withCredentials: true }).pipe(
      tap(() => {
        this.resetSessionCache();
        this.userStore.clear();
      }),
      map(() => undefined),
    );
  }
}
