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
    return cart
      .map((item) => {
        const product = this.resolveProduct(item.productId);
        if (!product) {
          return null;
        }
        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          color: item.color,
          size: item.size,
          giftPackaging: item.giftPackaging,
          unitPrice: product.price,
        };
      })
      .filter((item): item is OrderItem => item !== null);
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
      return this.placeDemoOrder(paymentMethod);
    }

    const payload: CreateOrderPayload = { items, address, paymentMethod };
    const { data, error } = await this.supabase.supabase.functions.invoke('create-order', {
      body: payload,
    });

    if (error) {
      throw new Error(error.message || 'Could not create your order. Please try again.');
    }

    const result = data as CreateOrderResult;
    this.lastOrder = { orderId: result.orderId, orderNumber: result.orderNumber, paymentMethod };
    return result;
  }

  private placeDemoOrder(paymentMethod: 'stripe' | 'cod'): CreateOrderResult {
    const result: CreateOrderResult = {
      orderId: `demo-${Date.now().toString(36)}`,
      orderNumber: `ZRY-${Math.floor(100000 + Math.random() * 900000)}`,
    };
    this.lastOrder = { orderId: result.orderId, orderNumber: result.orderNumber, paymentMethod };
    return result;
  }
}
