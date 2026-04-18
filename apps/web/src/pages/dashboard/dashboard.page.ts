import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthApiService } from '../../features/auth/model/auth-api.service';
import { UserStore } from '../../entities/user/model/user.store';
import { AppButtonComponent } from '../../shared/ui/button/app-button.component';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink, AppButtonComponent],
  template: `
    <section class="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div class="rounded-2xl bg-white p-6 shadow-sm">
        <h1 class="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p class="mt-2 text-slate-600">
          Welcome, {{ userStore.user()?.username ?? 'user' }}
        </p>
        <app-button class="mt-4" appearance="outline-grayscale" (click)="logout()">Logout</app-button>
      </div>

      <nav class="rounded-2xl bg-white p-4 shadow-sm">
        <p class="text-sm font-medium text-slate-700">Navigate</p>
        <div class="mt-2 flex flex-wrap gap-4">
          <a routerLink="/tasks" class="text-blue-600 hover:underline">Tasks</a>
          <a routerLink="/stats" class="text-blue-600 hover:underline">Stats</a>
        </div>
      </nav>
    </section>
  `,
})
export class DashboardPage {
  private readonly authApi = inject(AuthApiService);
  readonly userStore = inject(UserStore);

  logout(): void {
    this.authApi.logout().subscribe();
  }
}
