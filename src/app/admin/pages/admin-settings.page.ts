import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminContentService } from '../services/admin-content.service';
import { StoreSettings } from '../models';

function defaultSettings(): StoreSettings {
  return {
    siteName: 'Zaraya Handicrafts',
    currency: 'usd',
    announcement: '',
    shippingFee: 0,
    freeShippingThreshold: 0,
    giftPackagingFee: 0,
    supportEmail: '',
    supportPhone: '',
  };
}

@Component({
  selector: 'admin-settings-page',
  standalone: true,
  imports: [FormsModule],
  template: `
    <p class="admin-muted" style="margin-top:0">
      These values power the storefront header, checkout totals, and contact details.
    </p>

    @if (loading()) {
      <div class="admin-loading">Loading settings…</div>
    } @else {
      <form (ngSubmit)="save()">
        @if (error()) {
          <div class="admin-alert admin-alert-error" role="alert">{{ error() }}</div>
        }
        @if (saved()) {
          <div class="admin-alert admin-alert-success" role="status">Settings saved.</div>
        }

        <div class="admin-card">
          <h2>Store</h2>
          <div class="admin-field">
            <label for="s-name">Store name</label>
            <input id="s-name" type="text" [(ngModel)]="form().siteName" name="siteName" />
          </div>
          <div class="admin-field">
            <label for="s-currency">Currency code</label>
            <input id="s-currency" type="text" [(ngModel)]="form().currency" name="currency" />
          </div>
          <div class="admin-field">
            <label for="s-announcement">Announcement bar</label>
            <input
              id="s-announcement"
              type="text"
              [(ngModel)]="form().announcement"
              name="announcement"
              placeholder="Free shipping on orders over $75"
            />
          </div>
        </div>

        <div class="admin-card">
          <h2>Shipping &amp; packaging</h2>
          <div class="admin-field">
            <label for="s-shipping">Flat shipping fee</label>
            <input
              id="s-shipping"
              type="number"
              min="0"
              step="0.01"
              [(ngModel)]="form().shippingFee"
              name="shippingFee"
            />
          </div>
          <div class="admin-field">
            <label for="s-free">Free shipping threshold</label>
            <input
              id="s-free"
              type="number"
              min="0"
              step="0.01"
              [(ngModel)]="form().freeShippingThreshold"
              name="freeShippingThreshold"
            />
          </div>
          <div class="admin-field">
            <label for="s-gift">Gift packaging fee</label>
            <input
              id="s-gift"
              type="number"
              min="0"
              step="0.01"
              [(ngModel)]="form().giftPackagingFee"
              name="giftPackagingFee"
            />
          </div>
        </div>

        <div class="admin-card">
          <h2>Support</h2>
          <div class="admin-field">
            <label for="s-email">Support email</label>
            <input id="s-email" type="email" [(ngModel)]="form().supportEmail" name="supportEmail" />
          </div>
          <div class="admin-field">
            <label for="s-phone">Support phone</label>
            <input id="s-phone" type="text" [(ngModel)]="form().supportPhone" name="supportPhone" />
          </div>
        </div>

        <div class="admin-actions">
          <button type="submit" class="admin-btn admin-btn-primary" [disabled]="busy()">
            {{ busy() ? 'Saving…' : 'Save settings' }}
          </button>
        </div>
      </form>
    }
  `,
})
export class AdminSettingsPage {
  private readonly content = inject(AdminContentService);

  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly saved = signal(false);
  readonly error = signal('');
  readonly form = signal<StoreSettings>(defaultSettings());

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      this.form.set(await this.content.getSettings());
    } catch (error) {
      this.error.set('Could not load settings: ' + (error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    this.busy.set(true);
    this.saved.set(false);
    this.error.set('');
    try {
      await this.content.saveSettings(this.form());
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2500);
    } catch (error) {
      this.error.set('Could not save settings: ' + (error as Error).message);
    } finally {
      this.busy.set(false);
    }
  }
}
