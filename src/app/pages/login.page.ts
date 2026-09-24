import { Component } from '@angular/core';

@Component({
  selector: 'app-login-page',
  standalone: true,
  template: `
    <section class="container auth-page">
      <div class="auth-card">
        <p class="eyebrow">Welcome back</p>
        <h1>Login</h1>
        <form>
          <label>
            Email
            <input type="email" value="hello@zarayahandicrafts.com" />
          </label>
          <label>
            Password
            <input type="password" value="password" />
          </label>
          <button type="button" class="button button-primary">Sign in</button>
        </form>
      </div>
    </section>
  `,
  styleUrl: './login.page.scss',
})
export class LoginPage {}
