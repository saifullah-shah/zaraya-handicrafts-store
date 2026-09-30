import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { CustomerAuthService } from '../services/customer-auth.service';
import { ContentService } from '../services/content.service';
import { StoreSettingsService } from '../services/store-settings.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    @if (announcement(); as message) {
      <p class="announcement-bar">{{ message }}</p>
    }
    <header class="site-header">
      <div class="container header-inner">
        <a routerLink="/" class="brand" aria-label="Zaraya home">{{ siteName() }}</a>

        <nav class="main-nav" aria-label="Main navigation">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Home</a>
          <a routerLink="/products" routerLinkActive="active">Shop</a>
          <a routerLink="/about" routerLinkActive="active">About</a>
          <a routerLink="/contact" routerLinkActive="active">Contact</a>
        </nav>

        <div class="header-actions">
          @if (auth.user(); as user) {
            <a class="nav-link" routerLink="/account">{{ user.email || 'Account' }}</a>
            <button type="button" class="nav-link nav-button" (click)="signOut()">Sign out</button>
          } @else {
            <a class="nav-link" routerLink="/login">Login</a>
          }
          <a class="button button-primary" routerLink="/checkout">Checkout</a>
        </div>
      </div>
    </header>
  `,
  styleUrl: './header.component.scss',
})
export class HeaderComponent {
  readonly auth = inject(CustomerAuthService);
  private readonly content = inject(ContentService);
  private readonly settings = inject(StoreSettingsService);

  readonly siteName = computed(() => {
    const name = this.settings.siteName().trim();
    return name || 'Zaraya';
  });

  readonly announcement = computed(() => {
    const fromSettings = this.settings.announcement().trim();
    if (fromSettings) return fromSettings;
    return this.content.one('announcement').title.trim();
  });

  async signOut(): Promise<void> {
    await this.auth.signOut();
  }
}
