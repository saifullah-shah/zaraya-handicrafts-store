import { TestBed } from '@angular/core/testing';
import { PricingService } from './pricing.service';
import { StoreSettingsService } from './store-settings.service';
import { CartItem, Product } from '../models/store';

class StoreSettingsStub {
  settings = () => ({
    siteName: 'Zaraya',
    currency: 'usd',
    announcement: '',
    shippingCents: 1800,
    freeShippingThresholdCents: 20000,
    giftPackagingCents: 1200,
  });
}

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    slug: 'p1',
    name: 'Product One',
    price: 148,
    rating: 4.9,
    reviews: 10,
    badge: 'Best Seller',
    category: 'Jewelry',
    materials: [],
    description: 'desc',
    longDescription: 'long',
    images: ['a.jpg'],
    colors: ['Gold'],
    sizes: ['S'],
    stock: 5,
    giftPackaging: true,
    details: [],
    ...overrides,
  };
}

function makeItem(overrides: Partial<CartItem> = {}): CartItem {
  return {
    productId: 'p1',
    quantity: 1,
    color: 'Gold',
    size: 'S',
    giftPackaging: false,
    ...overrides,
  };
}

describe('PricingService', () => {
  let service: PricingService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PricingService, { provide: StoreSettingsService, useClass: StoreSettingsStub }],
    });
    service = TestBed.inject(PricingService);
  });

  it('formats prices as whole dollars', () => {
    expect(service.formatPrice(148)).toBe('$148');
    expect(service.formatPrice(1234.5)).toBe('$1,234.5');
  });

  it('derives the gift packaging price from store settings cents', () => {
    expect(service.giftPackagingPrice).toBe(12);
  });

  it('multiplies price by quantity for a line item', () => {
    expect(service.itemSubtotal(makeItem({ quantity: 3 }), makeProduct())).toBe(444);
  });

  it('returns zero for a line item whose product is missing', () => {
    expect(service.itemSubtotal(makeItem(), undefined)).toBe(0);
  });

  it('sums the subtotal across items', () => {
    const products = [makeProduct({ id: 'p1', price: 148 }), makeProduct({ id: 'p2', price: 20 })];
    const items = [makeItem({ productId: 'p1', quantity: 2 }), makeItem({ productId: 'p2' })];
    const resolve = (id: string) => products.find((p) => p.id === id);
    expect(service.subtotal(items, resolve)).toBe(316);
  });

  it('charges gift packaging per unit only when requested', () => {
    const products = [makeProduct()];
    const resolve = (id: string) => products.find((p) => p.id === id);
    expect(service.giftPackagingTotal([makeItem({ quantity: 2 })], resolve)).toBe(0);
    expect(
      service.giftPackagingTotal([makeItem({ quantity: 2, giftPackaging: true })], resolve),
    ).toBe(24);
  });

  it('never charges shipping on an empty cart', () => {
    expect(service.shipping(0)).toBe(0);
  });

  it('charges flat shipping below the free threshold', () => {
    expect(service.shipping(199)).toBe(18);
  });

  it('waives shipping at the free threshold', () => {
    expect(service.shipping(200)).toBe(0);
  });

  it('combines subtotal, packaging and shipping into a total', () => {
    const products = [makeProduct({ id: 'p1', price: 50 })];
    const resolve = (id: string) => products.find((p) => p.id === id);
    const items = [makeItem({ productId: 'p1', quantity: 2, giftPackaging: true })];
    const totals = service.totals(items, resolve);
    expect(totals).toEqual({ subtotal: 100, giftPackaging: 24, shipping: 18, total: 142 });
  });
});
