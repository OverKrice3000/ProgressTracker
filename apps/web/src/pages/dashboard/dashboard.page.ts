import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { UserStore } from '../../entities/user/model/user.store';

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4">
      <div class="rounded-2xl bg-white p-6 shadow-sm">
        <div class="space-y-2">
          <h1 class="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p class="text-slate-600">
            Welcome, {{ userStore.user()?.username ?? 'user' }}
          </p>
        </div>
      </div>
    </section>
  `,
})
export class DashboardPage {
  readonly userStore = inject(UserStore);
}
