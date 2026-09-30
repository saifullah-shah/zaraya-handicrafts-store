import { Injectable, inject } from '@angular/core';
import { CartItem, CheckoutTotals, Product } from '../models/store';
import { StoreSettingsService } from './store-settings.service';

@Injectable({ providedIn: 'root' })
export class PricingService {
  private readonly storeSettings = inject(StoreSettingsService);

  static readonly GIFT_PACKAGING_PRICE = 12;
  static readonly SHIPPING_FLAT = 18;
  static readonly FREE_SHIPPING_THRESHOLD = 200;

  get giftPackagingPrice(): number {
    return this.storeSettings.settings().giftPackagingCents / 100;
  }

  itemSubtotal(item: CartItem, product?: Product): number {
    if (!product) {
      return 0;
    }
    return product.price * item.quantity;
  }

  subtotal(items: CartItem[], resolve: (productId: string) => Product | undefined): number {
    return items.reduce(
      (total, item) => total + this.itemSubtotal(item, resolve(item.productId)),
      0,
    );
  }

  giftPackagingTotal(
    items: CartItem[],
    resolve: (productId: string) => Product | undefined,
  ): number {
    return items.reduce((total, item) => {
      if (!item.giftPackaging || !resolve(item.productId)) {
        return total;
      }
      return total + this.giftPackagingPrice * item.quantity;
    }, 0);
  }

  shipping(subtotal: number): number {
    if (subtotal <= 0) {
      return 0;
    }
    const settings = this.storeSettings.settings();
    return subtotal * 100 >= settings.freeShippingThresholdCents
      ? 0
      : settings.shippingCents / 100;
  }

  totals(items: CartItem[], resolve: (productId: string) => Product | undefined): CheckoutTotals {
    const subtotal = this.subtotal(items, resolve);
    const giftPackaging = this.giftPackagingTotal(items, resolve);
    const shipping = this.shipping(subtotal);
    return { subtotal, giftPackaging, shipping, total: subtotal + giftPackaging + shipping };
  }

  formatPrice(value: number): string {
    return `$${value.toLocaleString('en-US')}`;
  }
}
