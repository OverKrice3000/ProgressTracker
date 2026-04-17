import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export interface AuthUser {
  userId: string;
  username: string;
}

@Injectable({ providedIn: 'root' })
export class UserStore {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly userSignal = signal<AuthUser | null>(null);
  private readonly readySignal = signal(false);

  readonly user = computed(() => this.userSignal());
  readonly isReady = computed(() => this.readySignal());
  readonly isAuthenticated = computed(() => this.userSignal() !== null);
  readonly isBrowser = computed(() => isPlatformBrowser(this.platformId));

  setUser(user: AuthUser | null): void {
    this.userSignal.set(user);
    this.readySignal.set(true);
  }

  clear(): void {
    this.setUser(null);
  }
}
