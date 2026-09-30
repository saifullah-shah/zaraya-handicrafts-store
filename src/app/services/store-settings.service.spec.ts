import { TestBed } from '@angular/core/testing';
import { StoreSettingsService } from './store-settings.service';
import { SupabaseService } from './supabase.service';

type Row = { key: string; value: unknown };

class SupabaseStub {
  configured = true;
  result: { data: Row[] | null; error: { message: string } | null } = { data: [], error: null };
  requestedKeys: string[] = [];
  table = '';

  readonly supabase = {
    from: (table: string) => ({
      select: () => ({
        in: (_column: string, keys: string[]) => {
          this.requestedKeys = keys;
          this.table = table;
          return Promise.resolve(this.result);
        },
      }),
    }),
  };
}

function build(rows: Row[], configured = true) {
  const supabase = new SupabaseStub();
  supabase.configured = configured;
  supabase.result = { data: rows, error: null };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [StoreSettingsService, { provide: SupabaseService, useValue: supabase }],
  });
  return { service: TestBed.inject(StoreSettingsService), supabase };
}

describe('StoreSettingsService', () => {
  it('queries only the keys the storefront needs', async () => {
    const { service, supabase } = build([]);
    await Promise.resolve();
    expect(supabase.requestedKeys).toContain('shipping_fee_cents');
    expect(supabase.requestedKeys).toContain('free_shipping_threshold_cents');
    expect(supabase.requestedKeys).toContain('gift_packaging_cents');
    expect(service.settings().shippingCents).toBe(1800);
  });

  it('keeps money values numeric', async () => {
    const { service } = build([
      { key: 'shipping_fee_cents', value: 2400 },
      { key: 'free_shipping_threshold_cents', value: 50000 },
      { key: 'gift_packaging_cents', value: 1500 },
    ]);
    await Promise.resolve();
    expect(service.settings().shippingCents).toBe(2400);
    expect(service.settings().freeShippingThresholdCents).toBe(50000);
    expect(service.settings().giftPackagingCents).toBe(1500);
  });

  it('parses money stored as a JSON string, as the jsonb column allows', async () => {
    const { service } = build([{ key: 'shipping_fee_cents', value: '1800' }]);
    await Promise.resolve();
    expect(service.settings().shippingCents).toBe(1800);
  });

  it('unwraps a JSON-encoded string value', async () => {
    const { service } = build([
      { key: 'site_name', value: '"Zaraya"' },
      { key: 'currency', value: '"usd"' },
    ]);
    await Promise.resolve();
    expect(service.settings().siteName).toBe('Zaraya');
    expect(service.settings().currency).toBe('usd');
  });

  it('accepts a plain string value', async () => {
    const { service } = build([{ key: 'announcement', value: 'Free shipping over $200' }]);
    await Promise.resolve();
    expect(service.settings().announcement).toBe('Free shipping over $200');
    expect(service.announcement()).toBe('Free shipping over $200');
  });

  it('falls back to defaults when a money value is missing', async () => {
    const { service } = build([]);
    await Promise.resolve();
    expect(service.settings().shippingCents).toBe(1800);
    expect(service.settings().freeShippingThresholdCents).toBe(20000);
    expect(service.settings().giftPackagingCents).toBe(1200);
  });

  it('falls back when a money value is not a finite number', async () => {
    const { service } = build([{ key: 'shipping_fee_cents', value: 'not-a-number' }]);
    await Promise.resolve();
    expect(service.settings().shippingCents).toBe(1800);
  });

  it('falls back when a money value is negative or fractional', async () => {
    const { service } = build([
      { key: 'shipping_fee_cents', value: -100 },
      { key: 'gift_packaging_cents', value: 12.5 },
    ]);
    await Promise.resolve();
    expect(service.settings().shippingCents).toBe(1800);
    expect(service.settings().giftPackagingCents).toBe(1200);
  });

  it('keeps the default site name when the stored value is empty', async () => {
    const { service } = build([{ key: 'site_name', value: '' }]);
    await Promise.resolve();
    expect(service.settings().siteName).toBe('Zaraya');
  });

  it('does not turn a blank money value into free shipping', async () => {
    // Regression: Number('') is 0, and 0 passes the >= 0 guard, so a missing or blank
    // setting silently priced shipping at $0 instead of falling back to the default.
    const { service } = build([{ key: 'shipping_fee_cents', value: '' }]);
    await Promise.resolve();
    expect(service.settings().shippingCents).toBe(1800);
  });

  it('treats a whitespace-only money value as missing', async () => {
    const { service } = build([{ key: 'free_shipping_threshold_cents', value: '   ' }]);
    await Promise.resolve();
    expect(service.settings().freeShippingThresholdCents).toBe(20000);
  });

  it('mirrors the site name onto the signal the header binds to', async () => {
    const { service } = build([{ key: 'site_name', value: 'Zaraya' }]);
    await Promise.resolve();
    expect(service.siteName()).toBe('Zaraya');
  });

  it('does not query when Supabase is not configured', async () => {
    const { service, supabase } = build([], false);
    await Promise.resolve();
    expect(supabase.requestedKeys).toEqual([]);
    expect(service.settings().shippingCents).toBe(1800);
  });

  it('leaves defaults in place when the query fails', async () => {
    const supabase = new SupabaseStub();
    supabase.result = { data: null, error: { message: 'boom' } };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [StoreSettingsService, { provide: SupabaseService, useValue: supabase }],
    });
    const service = TestBed.inject(StoreSettingsService);
    await Promise.resolve();
    expect(service.settings().shippingCents).toBe(1800);
  });
});
