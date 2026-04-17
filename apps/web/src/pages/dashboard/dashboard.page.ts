import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthApiService } from '../../features/auth/model/auth-api.service';
import { UserStore } from '../../entities/user/model/user.store';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="page">
      <header>
        <h1>Dashboard</h1>
        <p>Welcome, {{ userStore.user()?.username ?? 'user' }}</p>
        <button (click)="logout()">Logout</button>
      </header>

      <nav>
        <a routerLink="/tasks">Tasks</a> |
        <a routerLink="/stats">Stats</a>
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
