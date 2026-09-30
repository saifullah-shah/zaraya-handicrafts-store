import { Component, ViewEncapsulation, inject, signal } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AdminAuthService } from '../services/admin-auth.service';

@Component({
  selector: 'admin-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  encapsulation: ViewEncapsulation.None,
  styleUrl: '../admin.scss',
  template: `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="admin-brand">
          <span class="admin-brand-mark">Z</span>
          <div>
            <strong>Zaraya</strong>
            <small>Content Studio</small>
          </div>
        </div>

        <nav class="admin-nav" aria-label="Admin navigation">
          <a routerLink="/admin/dashboard" routerLinkActive="active">Overview</a>
          <a routerLink="/admin/products" routerLinkActive="active">Products</a>
          <a routerLink="/admin/orders" routerLinkActive="active">Orders</a>
          <a routerLink="/admin/content" routerLinkActive="active">Homepage content</a>
          <a routerLink="/admin/settings" routerLinkActive="active">Store settings</a>
        </nav>

        <a class="admin-view-site" routerLink="/">
          <span>View storefront</span>
          <span aria-hidden="true">↗</span>
        </a>

        <div class="admin-user">
          <div class="admin-user-name">{{ user()?.email }}</div>
          <button type="button" class="admin-logout" (click)="logout()">Sign out</button>
        </div>
      </aside>

      <main class="admin-main">
        <header class="admin-topbar">
          <h1>{{ pageTitle() }}</h1>
          <span class="admin-topbar-hint">Store CMS</span>
        </header>

        <section class="admin-content">
          <router-outlet />
        </section>
      </main>
    </div>
  `,
})
export class AdminLayoutComponent {
  private readonly auth = inject(AdminAuthService);
  private readonly router = inject(Router);
  readonly user = this.auth.user;

  private readonly title = signal('Overview');
  readonly pageTitle = this.title.asReadonly();

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.updateTitle(this.router.url));
    this.updateTitle(this.router.url);
  }

  private updateTitle(url: string): void {
    const path = url.split('?')[0];
    if (path.startsWith('/admin/products')) this.title.set('Products');
    else if (path.startsWith('/admin/orders')) this.title.set('Orders');
    else if (path.startsWith('/admin/content')) this.title.set('Homepage content');
    else if (path.startsWith('/admin/settings')) this.title.set('Store settings');
    else this.title.set('Overview');
  }

  logout(): void {
    void this.auth.logout().then(() => {
      window.location.href = '/admin/login';
    });
  }
}