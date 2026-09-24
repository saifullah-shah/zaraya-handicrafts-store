import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CheckoutService } from '../services/checkout.service';

@Component({
  selector: 'app-order-confirmation-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="container confirmation-page">
      <div class="panel confirmation-card">
        <div class="check-mark" aria-hidden="true">✓</div>
        <p class="eyebrow">Order confirmed</p>
        <h1>Thank you, we’ll take it from here.</h1>

        @if (order) {
          <p class="order-number">
            Order number <strong>{{ order.orderNumber }}</strong>
          </p>
          <div class="payment-note">
            @if (order.paymentMethod === 'stripe') {
              <p>
                Your card payment is being processed by Stripe. We’ll email you a confirmation once
                it’s settled.
              </p>
            } @else {
              <p>
                You chose <strong>cash on delivery</strong>. Please have {{ lastTotal }} ready when
                your order arrives.
              </p>
            }
          </div>
        } @else {
          <p>Your order is being processed. A confirmation will follow by email.</p>
        }

        <div class="actions">
          <a routerLink="/" class="button button-primary">Continue shopping</a>
        </div>
      </div>
    </section>
  `,
  styleUrl: './order-confirmation.page.scss',
})
export class OrderConfirmationPage implements OnInit {
  private readonly router = inject(Router);
  private readonly checkoutService = inject(CheckoutService);

  order = this.checkoutService.lastOrder;
  lastTotal = '';

  ngOnInit(): void {
    const storedOrder = globalThis.sessionStorage?.getItem('zaraya-last-order');
    const storedTotal = globalThis.sessionStorage?.getItem('zaraya-last-total');
    if (storedTotal) {
      this.lastTotal = storedTotal;
    }
    if (storedOrder) {
      try {
        const parsed = JSON.parse(storedOrder) as {
          orderId?: string;
          orderNumber?: string;
          paymentMethod?: 'cod' | 'stripe';
        };
        this.order = {
          orderId: parsed.orderId ?? this.order.orderId,
          orderNumber: parsed.orderNumber ?? this.order.orderNumber,
          paymentMethod: parsed.paymentMethod ?? this.order.paymentMethod,
        };
      } catch {}
    }
    if (!this.order.orderNumber && !this.order.orderId) {
      void this.router.navigate(['/']);
    }
  }
}
