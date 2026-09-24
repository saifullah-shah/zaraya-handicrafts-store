import { Injectable } from '@angular/core';
import { CartItem, CheckoutTotals, Product } from '../models/store';

@Injectable({ providedIn: 'root' })
export class PricingService {
  static readonly GIFT_PACKAGING_PRICE = 12;
  static readonly SHIPPING_FLAT = 18;
  static readonly FREE_SHIPPING_THRESHOLD = 200;

  itemSubtotal(item: CartItem, product?: Product): number {
    if (!product) {
      return 0;
    }
    const gift = item.giftPackaging ? PricingService.GIFT_PACKAGING_PRICE : 0;
    return (product.price + gift) * item.quantity;
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
      return total + PricingService.GIFT_PACKAGING_PRICE * item.quantity;
    }, 0);
  }

  shipping(subtotal: number): number {
    if (subtotal <= 0) {
      return 0;
    }
    return subtotal >= PricingService.FREE_SHIPPING_THRESHOLD ? 0 : PricingService.SHIPPING_FLAT;
  }

  totals(items: CartItem[], resolve: (productId: string) => Product | undefined): CheckoutTotals {
    const subtotal = this.subtotal(items, resolve);
    const giftPackaging = this.giftPackagingTotal(items, resolve);
    const shipping = this.shipping(subtotal);
    return { subtotal, giftPackaging, shipping, total: subtotal + shipping };
  }

  formatPrice(value: number): string {
    return `$${value.toLocaleString('en-US')}`;
  }
}
