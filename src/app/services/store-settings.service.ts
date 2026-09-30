import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface StorePricingSettings {
  siteName: string;
  currency: string;
  announcement: string;
  shippingCents: number;
  freeShippingThresholdCents: number;
  giftPackagingCents: number;
}

@Injectable({ providedIn: 'root' })
export class StoreSettingsService {
  private readonly supabase = inject(SupabaseService);
  readonly settings = signal<StorePricingSettings>({
    siteName: 'Zaraya',
    currency: 'usd',
    announcement: '',
    shippingCents: 1800,
    freeShippingThresholdCents: 20000,
    giftPackagingCents: 1200,
  });

  readonly siteName = signal('Zaraya');
  readonly announcement = signal('');

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.supabase.configured) {
      return;
    }
    try {
      const { data, error } = await this.supabase.supabase
        .from('store_settings')
        .select('key, value')
        .in('key', [
          'site_name',
          'currency',
          'announcement',
          'shipping_fee_cents',
          'free_shipping_threshold_cents',
          'gift_packaging_cents',
        ]);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as Array<{ key: string; value: unknown }>;
      const text = (key: string): string => {
        const row = rows.find((item) => item.key === key);
        if (row?.value === null || row?.value === undefined) return '';
        const raw = typeof row.value === 'string' ? row.value : String(row.value);
        if (raw.length > 1 && raw.startsWith('"') && raw.endsWith('"')) {
          try {
            return JSON.parse(raw) as string;
          } catch {
            return raw.slice(1, -1);
          }
        }
        return raw;
      };
      const number = (key: string): number | undefined => {
        const value = text(key);
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      };
      const current = this.settings();
      const next: StorePricingSettings = {
        siteName: text('site_name') || current.siteName,
        currency: text('currency') || current.currency,
        announcement: text('announcement'),
        shippingCents: this.cents(number('shipping_fee_cents'), current.shippingCents),
        freeShippingThresholdCents: this.cents(
          number('free_shipping_threshold_cents'),
          current.freeShippingThresholdCents,
        ),
        giftPackagingCents: this.cents(number('gift_packaging_cents'), current.giftPackagingCents),
      };
      this.settings.set(next);
      this.siteName.set(next.siteName);
      this.announcement.set(next.announcement);
    } catch (error) {
      console.error('Store settings unavailable.', error);
    }
  }

  private cents(value: number | undefined, fallback: number): number {
    return value !== undefined && Number.isInteger(value) && value >= 0 ? value : fallback;
  }
}
