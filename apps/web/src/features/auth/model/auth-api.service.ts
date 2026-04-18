import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of, tap } from 'rxjs';
import { AuthUser, UserStore } from '../../../entities/user/model/user.store';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly userStore = inject(UserStore);
  private readonly platformId = inject(PLATFORM_ID);

  hydrateSession(): Observable<AuthUser | null> {
    if (!isPlatformBrowser(this.platformId)) {
      this.userStore.setUser(null);
      return of(null);
    }
    return this.http
      .get<AuthUser>('api/auth/me', { withCredentials: true })
      .pipe(
        tap((user) => this.userStore.setUser(user)),
        catchError(() => {
          this.userStore.clear();
          return of(null);
        }),
      );
  }

  login(username: string, password: string): Observable<AuthUser> {
    return this.http
      .post<AuthUser>(
        'api/auth/login',
        { username, password },
        { withCredentials: true },
      )
      .pipe(tap((user) => this.userStore.setUser(user)));
  }

  logout(): Observable<void> {
    return this.http.post<{ ok: true }>('api/auth/logout', {}, { withCredentials: true }).pipe(
      tap(() => this.userStore.clear()),
      map(() => undefined),
    );
  }
}
