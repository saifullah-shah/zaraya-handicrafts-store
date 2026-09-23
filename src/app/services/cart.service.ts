import { Injectable, signal } from '@angular/core';
import { CartItem } from '../models/store';

@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly storageKey = 'zaraya-cart';
  readonly cart = signal<CartItem[]>(this.readCart());

  addToCart(productId: string, color: string, size: string, giftPackaging: boolean, quantity = 1): void {
    const current = this.cart();
    const existingIndex = current.findIndex(
      (item) => item.productId === productId && item.color === color && item.size === size && item.giftPackaging === giftPackaging,
    );

    if (existingIndex >= 0) {
      current[existingIndex] = {
        ...current[existingIndex],
        quantity: current[existingIndex].quantity + quantity,
      };
      this.persist(current);
      return;
    }

    const updated = [...current, { productId, quantity, color, size, giftPackaging }];
    this.persist(updated);
  }

  updateQuantity(productId: string, color: string, size: string, giftPackaging: boolean, quantity: number): void {
    const current = this.cart()
      .map((item) => {
        if (item.productId === productId && item.color === color && item.size === size && item.giftPackaging === giftPackaging) {
          return { ...item, quantity: Math.max(0, quantity) };
        }
        return item;
      })
      .filter((item) => item.quantity > 0);

    this.persist(current);
  }

  removeItem(productId: string, color: string, size: string, giftPackaging: boolean): void {
    const filtered = this.cart().filter(
      (item) => !(item.productId === productId && item.color === color && item.size === size && item.giftPackaging === giftPackaging),
    );
    this.persist(filtered);
  }

  clearCart(): void {
    this.persist([]);
  }

  private persist(items: CartItem[]): void {
    this.cart.set(items);
    globalThis.localStorage?.setItem(this.storageKey, JSON.stringify(items));
  }

  private readCart(): CartItem[] {
    try {
      const raw = globalThis.localStorage?.getItem(this.storageKey);
      return raw ? (JSON.parse(raw) as CartItem[]) : [];
    } catch {
      return [];
    }
  }
}
