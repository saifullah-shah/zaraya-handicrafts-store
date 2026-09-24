import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartItem } from '../models/store';
import { CartService } from '../services/cart.service';
import { PricingService } from '../services/pricing.service';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-cart-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="container cart-page">
      <div class="section-heading">
        <p class="eyebrow">Your cart</p>
        <h1>Thoughtfully collected.</h1>
      </div>

      @if (cartItems().length === 0) {
        <div class="empty-state">
          <h2>Your cart is empty</h2>
          <p>Browse the collection and add a piece you’ll love returning to.</p>
          <a routerLink="/" class="button button-primary">Continue shopping</a>
        </div>
      } @else {
        <div class="cart-layout">
          <div class="cart-items">
            @for (
              item of cartItems();
              track item.productId + item.color + item.size + item.giftPackaging
            ) {
              @let product = getProduct(item.productId);
              @if (product) {
                <article class="cart-item">
                  <img [src]="product.images[0]" [alt]="product.name" />
                  <div class="item-copy">
                    <h2>{{ product.name }}</h2>
                    <p>{{ item.color }} / {{ item.size }}</p>
                    <p>
                      @if (item.giftPackaging) {
                        Gift packaging included
                      } @else {
                        No gift packaging
                      }
                    </p>
                    <div class="item-actions">
                      <button type="button" (click)="updateQuantity(item, item.quantity - 1)">
                        −
                      </button>
                      <span>{{ item.quantity }}</span>
                      <button type="button" (click)="updateQuantity(item, item.quantity + 1)">
                        +
                      </button>
                      <button type="button" class="remove" (click)="removeItem(item)">
                        Remove
                      </button>
                    </div>
                  </div>
                  <div class="price-col">{{ pricing.formatPrice(itemTotal(item)) }}</div>
                </article>
              }
            }
          </div>

          <aside class="summary">
            <h3>Order summary</h3>
            <div class="summary-row">
              <span>Subtotal</span><strong>{{ pricing.formatPrice(totals().subtotal) }}</strong>
            </div>
            @if (totals().giftPackaging > 0) {
              <div class="summary-row">
                <span>Gift packaging</span>
                <strong>{{ pricing.formatPrice(totals().giftPackaging) }}</strong>
              </div>
            }
            <div class="summary-row">
              <span>Shipping</span><strong>Calculated at checkout</strong>
            </div>
            <div class="summary-row total">
              <span>Total</span><strong>{{ pricing.formatPrice(totals().total) }}</strong>
            </div>
            <a routerLink="/checkout" class="button button-primary full-width"
              >Proceed to checkout</a
            >
          </aside>
        </div>
      }
    </section>
  `,
  styleUrl: './cart.page.scss',
})
export class CartPage {
  private readonly cartService = inject(CartService);
  private readonly productService = inject(ProductService);
  readonly pricing = inject(PricingService);

  readonly cartItems = this.cartService.cart;

  readonly totals = computed(() =>
    this.pricing.totals(this.cartItems(), (id) => this.productService.getProductById(id)),
  );

  getProduct(productId: string) {
    return this.productService.getProductById(productId);
  }

  itemTotal(item: CartItem): number {
    return this.pricing.itemSubtotal(item, this.getProduct(item.productId));
  }

  updateQuantity(item: CartItem, quantity: number): void {
    this.cartService.updateQuantity(
      item.productId,
      item.color,
      item.size,
      item.giftPackaging,
      quantity,
    );
  }

  removeItem(item: CartItem): void {
    this.cartService.removeItem(item.productId, item.color, item.size, item.giftPackaging);
  }
}
