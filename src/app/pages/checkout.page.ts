import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartService } from '../services/cart.service';
import { CheckoutService } from '../services/checkout.service';
import { PricingService } from '../services/pricing.service';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-checkout-page',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="container checkout-page">
      <div class="section-heading">
        <p class="eyebrow">Checkout</p>
        <h1>Complete your order.</h1>
      </div>

      @if (cart().length === 0) {
        <div class="panel empty-state">
          <h2>Your cart is empty</h2>
          <p>Add a piece from the collection before checking out.</p>
          <a routerLink="/" class="button button-primary">Continue shopping</a>
        </div>
      } @else {
        <form class="checkout-layout" [formGroup]="form" (ngSubmit)="submit()">
          <div class="panel">
            <h2>Shipping details</h2>
            <div class="checkout-form">
              <label>
                Full name
                <input type="text" formControlName="fullName" required />
              </label>
              <label>
                Email
                <input type="email" formControlName="email" required />
              </label>
              <label>
                Phone
                <input type="tel" formControlName="phone" />
              </label>
              <label>
                Street address
                <input type="text" formControlName="street" required />
              </label>
              <div class="form-row">
                <label>
                  City
                  <input type="text" formControlName="city" required />
                </label>
                <label>
                  State / Province
                  <input type="text" formControlName="state" />
                </label>
              </div>
              <div class="form-row">
                <label>
                  Postal code
                  <input type="text" formControlName="postalCode" />
                </label>
                <label>
                  Country
                  <input type="text" formControlName="country" required />
                </label>
              </div>
            </div>

            <h2 class="method-heading">Payment method</h2>
            <div class="method-list">
              <label class="method-card" [class.selected]="form.value.paymentMethod === 'stripe'">
                <input type="radio" formControlName="paymentMethod" value="stripe" />
                <span class="method-copy">
                  <strong>Card — Stripe</strong>
                  <small>Secure card payment, processed by Stripe.</small>
                </span>
              </label>
              <label class="method-card" [class.selected]="form.value.paymentMethod === 'cod'">
                <input type="radio" formControlName="paymentMethod" value="cod" />
                <span class="method-copy">
                  <strong>Cash on delivery</strong>
                  <small>Pay when your order arrives. Available in select countries.</small>
                </span>
              </label>
            </div>
          </div>

          <aside class="panel summary">
            <h2>Order summary</h2>
            <div class="item-lines">
              @for (line of lineItems(); track line.key) {
                <div class="summary-line">
                  <span>{{ line.name }} × {{ line.quantity }}</span>
                  <strong>{{ line.subtotal }}</strong>
                </div>
              }
            </div>
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
              <span>Shipping</span>
              <strong>{{
                totals().shipping === 0 ? 'Free' : pricing.formatPrice(totals().shipping)
              }}</strong>
            </div>
            <div class="summary-row total">
              <span>Total</span><strong>{{ pricing.formatPrice(totals().total) }}</strong>
            </div>

            @if (submitting()) {
              <button type="button" class="button button-primary full-width" disabled>
                Placing your order…
              </button>
            } @else {
              <button
                type="submit"
                class="button button-primary full-width"
                [disabled]="form.invalid"
              >
                {{ form.value.paymentMethod === 'stripe' ? 'Pay now' : 'Place order' }}
              </button>
            }
            @if (error()) {
              <p class="error-text">{{ error() }}</p>
            }
          </aside>
        </form>
      }
    </section>
  `,
  styleUrl: './checkout.page.scss',
})
export class CheckoutPage {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly cartService = inject(CartService);
  private readonly productService = inject(ProductService);
  private readonly checkoutService = inject(CheckoutService);
  readonly pricing = inject(PricingService);

  readonly submitting = signal(false);
  readonly error = signal('');

  readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
    street: ['', Validators.required],
    city: ['', Validators.required],
    state: [''],
    postalCode: [''],
    country: ['', Validators.required],
    paymentMethod: ['stripe' as 'stripe' | 'cod', Validators.required],
  });

  readonly cart = this.cartService.cart;

  readonly resolve = (id: string) => this.productService.getProductById(id);

  readonly totals = computed(() => this.pricing.totals(this.cart(), this.resolve));

  readonly lineItems = computed(() =>
    this.cart().map((item) => {
      const product = this.resolve(item.productId);
      const gift = item.giftPackaging ? PricingService.GIFT_PACKAGING_PRICE : 0;
      const unit = (product ? product.price : 0) + gift;
      return {
        key: `${item.productId}-${item.color}-${item.size}-${item.giftPackaging}`,
        name: product ? product.name : item.productId,
        quantity: item.quantity,
        subtotal: this.pricing.formatPrice(unit * item.quantity),
      };
    }),
  );

  async submit(): Promise<void> {
    if (this.form.invalid || this.submitting()) {
      return;
    }
    this.error.set('');
    this.submitting.set(true);
    try {
      const { fullName, email, phone, street, city, state, postalCode, country, paymentMethod } =
        this.form.value;
      const result = await this.checkoutService.placeOrder(
        this.cart(),
        {
          fullName: fullName ?? '',
          email: email ?? '',
          phone: phone ?? '',
          street: street ?? '',
          city: city ?? '',
          state: state ?? '',
          postalCode: postalCode ?? '',
          country: country ?? '',
        },
        (paymentMethod ?? 'stripe') as 'stripe' | 'cod',
      );
      const totalsSnapshot = this.pricing.formatPrice(this.totals().total);
      this.cartService.clearCart();
      if (result.sessionUrl && typeof window !== 'undefined') {
        globalThis.sessionStorage?.setItem(
          'zaraya-last-order',
          JSON.stringify({ ...result, paymentMethod }),
        );
        globalThis.sessionStorage?.setItem('zaraya-last-total', totalsSnapshot);
        window.location.assign(result.sessionUrl);
        return;
      }
      globalThis.sessionStorage?.setItem(
        'zaraya-last-order',
        JSON.stringify({ ...result, paymentMethod }),
      );
      globalThis.sessionStorage?.setItem('zaraya-last-total', totalsSnapshot);
      await this.router.navigate(['/order-confirmation']);
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'Something went wrong placing your order.',
      );
    } finally {
      this.submitting.set(false);
    }
  }
}
