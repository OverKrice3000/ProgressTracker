import { Routes } from '@angular/router';
import { authGuard, loginRedirectGuard } from './guards/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [loginRedirectGuard],
    loadComponent: () =>
      import('../pages/login/login.page').then((module) => module.LoginPage),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../pages/dashboard/dashboard.page').then((module) => module.DashboardPage),
  },
  {
    path: 'tasks',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../pages/tasks/tasks.page').then((module) => module.TasksPage),
  },
  {
    path: 'task/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../pages/task-detail/task-detail.page').then((module) => module.TaskDetailPage),
  },
  {
    path: 'stats',
    canActivate: [authGuard],
    loadComponent: () =>
      import('../pages/stats/stats.page').then((module) => module.StatsPage),
  },
  {
    path: 'logs',
    canActivate: [authGuard],
    loadComponent: () => import('../pages/logs/logs.page').then((module) => module.LogsPage),
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
];
