import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AuthApiService } from '../../features/auth/model/auth-api.service';
import { AppButtonComponent } from '../../shared/ui/button/app-button.component';
import { AppInputComponent } from '../../shared/ui/input/app-input.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, AppButtonComponent, AppInputComponent, TranslocoPipe],
  template: `
    <section class="mx-auto mt-12 flex w-full max-w-md flex-col gap-8 rounded-2xl bg-white p-8 shadow-md">
      <div class="space-y-2">
        <h1 class="text-2xl font-semibold text-slate-900">{{ 'login.title' | transloco }}</h1>
        <p class="text-sm text-slate-500">{{ 'login.subtitle' | transloco }}</p>
      </div>

      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-6">
        <app-input
          [label]="'login.username' | transloco"
          [control]="form.controls.username"
          [error]="'login.usernameRequired' | transloco"
        />
        <app-input
          [label]="'login.password' | transloco"
          type="password"
          [control]="form.controls.password"
          [error]="'login.passwordRequired' | transloco"
        />
        <app-button type="submit" [loading]="loading()" [disabled]="form.invalid" class="w-full">
          {{ 'login.signIn' | transloco }}
        </app-button>
      </form>

      <p *ngIf="error()" class="text-sm text-rose-600">{{ error() }}</p>
    </section>
  `,
})
export class LoginPage {
  private readonly fb = inject(FormBuilder);
  private readonly authApi = inject(AuthApiService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

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
        this.error.set(this.transloco.translate('login.loginFailed'));
      },
    });
  }
}
