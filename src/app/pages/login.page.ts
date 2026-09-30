import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CustomerAuthService } from '../services/customer-auth.service';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <section class="container auth-page">
      <div class="auth-card">
        <p class="eyebrow">{{ registerMode() ? 'Create an account' : 'Welcome back' }}</p>
        <h1>{{ registerMode() ? 'Join Zaraya' : 'Login' }}</h1>
        <p class="auth-copy">Save your details and keep track of your orders.</p>

        @if (error()) {
          <p class="auth-error" role="alert">{{ error() }}</p>
        }
        @if (message()) {
          <p class="auth-message" role="status">{{ message() }}</p>
        }

        <form (ngSubmit)="submit()">
          @if (registerMode()) {
            <label>
              Name
              <input type="text" [(ngModel)]="form.name" name="name" autocomplete="name" required />
            </label>
          }
          <label>
            Email
            <input type="email" [(ngModel)]="form.email" name="email" autocomplete="email" required />
          </label>
          <label>
            Password
            <input
              type="password"
              [(ngModel)]="form.password"
              name="password"
              [autocomplete]="registerMode() ? 'new-password' : 'current-password'"
              minlength="8"
              required
            />
          </label>
          <button type="submit" class="button button-primary" [disabled]="busy()">
            {{ busy() ? 'Please wait…' : registerMode() ? 'Create account' : 'Sign in' }}
          </button>
        </form>

        <button type="button" class="auth-switch" (click)="toggleMode()">
          {{ registerMode() ? 'Already have an account? Sign in' : 'New to Zaraya? Create an account' }}
        </button>
        <a routerLink="/" class="auth-back">Continue shopping</a>
      </div>
    </section>
  `,
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly auth = inject(CustomerAuthService);
  private readonly router = inject(Router);
  readonly registerMode = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  readonly form = { name: '', email: '', password: '' };

  toggleMode(): void {
    this.registerMode.update((value) => !value);
    this.error.set('');
    this.message.set('');
  }

  async submit(): Promise<void> {
    this.busy.set(true);
    this.error.set('');
    this.message.set('');
    try {
      if (this.registerMode()) {
        const result = await this.auth.signUp(this.form.name.trim(), this.form.email.trim(), this.form.password);
        if (result.error) {
          this.error.set(result.error);
          return;
        }
        if (result.message) this.message.set(result.message);
        if (this.auth.user()) await this.router.navigateByUrl('/account');
      } else {
        const error = await this.auth.signIn(this.form.email.trim(), this.form.password);
        if (error) {
          this.error.set(error);
          return;
        }
        await this.router.navigateByUrl('/account');
      }
    } finally {
      this.busy.set(false);
    }
  }
}
