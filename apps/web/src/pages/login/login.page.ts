import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthApiService } from '../../features/auth/model/auth-api.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <section class="page">
      <h1>Login</h1>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>
          Username
          <input formControlName="username" />
        </label>
        <label>
          Password
          <input type="password" formControlName="password" />
        </label>
        <button type="submit" [disabled]="loading()">Sign in</button>
      </form>
      <p *ngIf="error()">{{ error() }}</p>
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
