import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

@Component({
  selector: 'admin-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="admin-login-wrap">
      <form class="admin-login-card" (ngSubmit)="submit()">
        <div class="admin-login-logo">Z</div>
        <h1>Zaraya admin</h1>

        @if (error()) {
          <div class="admin-alert admin-alert-error" role="alert">{{ error() }}</div>
        }

        <div class="admin-form">
          <div class="admin-field">
            <label for="admin-email">Email</label>
            <input
              id="admin-email"
              type="email"
              name="email"
              [(ngModel)]="email"
              required
              autocomplete="username"
            />
          </div>
          <div class="admin-field">
            <label for="admin-password">Password</label>
            <input
              id="admin-password"
              type="password"
              name="password"
              [(ngModel)]="password"
              required
              autocomplete="current-password"
            />
          </div>

          <div class="admin-actions">
            <button type="submit" class="admin-btn admin-btn-primary" [disabled]="busy()">
              {{ busy() ? 'Signing in…' : 'Sign in' }}
            </button>
            <a class="admin-muted" routerLink="/">← Back to storefront</a>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class AdminLoginPage {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly busy = signal(false);
  readonly error = signal('');

  async submit(): Promise<void> {
    if (this.busy() || !this.email() || !this.password()) return;
    this.busy.set(true);
    this.error.set('');
    if (typeof window !== 'undefined') {
      await this.auth.init();
    }
    const result = await this.auth.login(this.email(), this.password());
    this.busy.set(false);
    if (result.error) {
      this.error.set(result.error);
      return;
    }
    await this.router.navigate(['/admin/dashboard']);
  }
}