import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApiService } from '../../features/auth/model/auth-api.service';
import { AppButtonComponent } from '../../shared/ui/button/app-button.component';
import { AppInputComponent } from '../../shared/ui/input/app-input.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppButtonComponent, AppInputComponent],
  template: `
    <section class="mx-auto mt-12 w-full max-w-md rounded-2xl bg-white p-6 shadow-md">
      <h1 class="mb-1 text-2xl font-semibold text-slate-900">Login</h1>
      <p class="mb-6 text-sm text-slate-500">Sign in to continue to the dashboard.</p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="space-y-4">
        <app-input
          label="Username"
          [control]="form.controls.username"
          hint="Use your unique account name"
          error="Username is required"
        />
        <app-input
          label="Password"
          type="password"
          [control]="form.controls.password"
          error="Password is required"
        />
        <app-button [loading]="loading()" [disabled]="form.invalid" class="w-full">Sign in</app-button>
      </form>

      <p *ngIf="error()" class="mt-3 text-sm text-rose-600">{{ error() }}</p>
    </section>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);

  readonly loading = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    username: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid || this.loading()) {
      return;
    }
    this.loading.set(true);
    this.error.set('');
    const { username, password } = this.form.getRawValue();
    this.authApi.login(username, password).subscribe({
      next: () => {
        this.loading.set(false);
        void this.router.navigateByUrl('/dashboard');
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Login failed');
      },
    });
  }
}
