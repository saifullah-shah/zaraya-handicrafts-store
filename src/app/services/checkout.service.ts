import { Injectable } from '@angular/core';
import {
  Address,
  CartItem,
  CreateOrderPayload,
  CreateOrderResult,
  OrderItem,
} from '../models/store';
import { ProductService } from './product.service';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class CheckoutService {
  lastOrder = { orderId: '', orderNumber: '', paymentMethod: 'cod' as 'cod' | 'stripe' };

  constructor(
    private readonly supabase: SupabaseService,
    private readonly productService: ProductService,
  ) {}

  resolveProduct(productId: string) {
    return this.productService.getProductById(productId);
  }

  buildOrderItems(cart: CartItem[]): OrderItem[] {
    return cart.map((item) => {
      const product = this.resolveProduct(item.productId);
      if (!product) {
        throw new Error('One or more products in your cart are no longer available.');
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 99) {
        throw new Error('Cart quantities must be between 1 and 99.');
      }
      return {
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        color: item.color,
        size: item.size,
        giftPackaging: Boolean(item.giftPackaging),
        unitPrice: product.price,
      };
    });
  }

  async placeOrder(
    cart: CartItem[],
    address: Address,
    paymentMethod: 'stripe' | 'cod',
  ): Promise<CreateOrderResult> {
    if (cart.length === 0) {
      throw new Error('Your cart is empty.');
    }

    const items = this.buildOrderItems(cart);
    if (items.length === 0) {
      throw new Error('Your cart contains items that are no longer available.');
    }

    if (!this.supabase.configured) {
      throw new Error('Checkout is temporarily unavailable. Please try again later.');
    }

    const idempotencyKey = this.createIdempotencyKey();
    const payload: CreateOrderPayload = {
      items: items.map(({ productId, quantity, color, size, giftPackaging }) => ({
        productId,
        quantity,
        color,
        size,
        giftPackaging,
      })),
      address,
      paymentMethod,
      idempotencyKey,
    };
    const { data, error } = await this.supabase.supabase.functions.invoke('create-order', {
      body: payload,
      headers: { 'Idempotency-Key': idempotencyKey },
    });

    if (error) {
      throw new Error(error.message || 'Could not create your order. Please try again.');
    }

    const result = data as CreateOrderResult;
    if (!result?.orderId || !result.orderNumber) {
      throw new Error('The order response was incomplete. Please try again.');
    }
    this.lastOrder = {
      orderId: result.orderId,
      orderNumber: result.orderNumber,
      paymentMethod,
    };
    return result;
  }

  private createIdempotencyKey(): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  }
}
