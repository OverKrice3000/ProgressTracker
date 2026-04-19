import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TuiRoot } from '@taiga-ui/core/components/root';
import { filter, map, startWith } from 'rxjs';
import { UserStore } from '../entities/user/model/user.store';
import { AuthApiService } from '../features/auth/model/auth-api.service';
import { TaskTrackingStore } from '../features/tasks/model/task-tracking.store';
import { AppButtonComponent } from '../shared/ui/button/app-button.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TuiRoot, AppButtonComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly userStore = inject(UserStore);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  readonly trackingStore = inject(TaskTrackingStore);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  readonly showHeader = computed(() => !this.currentUrl().startsWith('/login'));

  constructor() {
    this.trackingStore.loadCurrent();
  }

  logout(): void {
    this.authApi.logout().subscribe(() => {
      void this.router.navigateByUrl('/login');
    });
  }

  formatElapsedMinutes(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}h ${m}m`;
  }

  stopTrackingFromHeader(): void {
    const active = this.trackingStore.currentSession();
    if (!active) {
      return;
    }
    void this.router.navigate(['/task', active.taskId], {
      queryParams: {
        log: '1',
        stopTracking: '1',
        elapsed: String(this.trackingStore.elapsedMinutes()),
      },
    });
  }
}
