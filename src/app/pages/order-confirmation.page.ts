import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../services/supabase.service';

interface ConfirmationItem {
  productName: string;
  quantity: number;
  color: string;
  size: string;
  giftPackaging: boolean;
  unitPriceCents: number;
}

interface ConfirmationOrder {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: 'cod' | 'stripe';
  totalCents: number;
  currency: string;
  items: ConfirmationItem[];
}

@Component({
  selector: 'app-order-confirmation-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="container confirmation-page">
      <div class="panel confirmation-card">
        @if (loading()) {
          <div class="check-mark" aria-hidden="true">…</div>
          <p class="eyebrow">Order status</p>
          <h1>We’re confirming your order.</h1>
        } @else if (error()) {
          <div class="check-mark" aria-hidden="true">!</div>
          <p class="eyebrow">Order status</p>
          <h1>We couldn’t load that confirmation.</h1>
          <p>{{ error() }}</p>
          <div class="actions">
            <a routerLink="/" class="button button-primary">Continue shopping</a>
          </div>
        } @else if (order(); as current) {
          <div class="check-mark" aria-hidden="true">✓</div>
          <p class="eyebrow">Order confirmed</p>
          <h1>Thank you, we’ll take it from here.</h1>
          <p class="order-number">
            Order number <strong>{{ current.orderNumber }}</strong>
          </p>
          <div class="payment-note">
            @if (current.paymentMethod === 'stripe') {
              @if (current.status === 'paid') {
                <p>Your payment was confirmed. We’ll email you when your order ships.</p>
              } @else {
                <p>Your payment is being confirmed by Stripe. This page can be refreshed shortly.</p>
              }
            } @else {
              <p>
                You chose <strong>cash on delivery</strong>. Please have {{ formattedTotal() }} ready
                when your order arrives.
              </p>
            }
          </div>
          <div class="actions">
            <a routerLink="/" class="button button-primary">Continue shopping</a>
          </div>
        }
      </div>
    </section>
  `,
  styleUrl: './order-confirmation.page.scss',
})
export class OrderConfirmationPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly supabase = inject(SupabaseService);

  readonly loading = signal(true);
  readonly error = signal('');
  readonly order = signal<ConfirmationOrder | null>(null);
  readonly total = signal(0);
  readonly currency = signal('usd');

  ngOnInit(): void {
    void this.loadOrder();
  }

  formattedTotal(): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: this.currency().toUpperCase(),
    }).format(this.total() / 100);
  }

  private async loadOrder(): Promise<void> {
    const stored = this.readStoredOrder();
    const sessionId = this.route.snapshot.queryParamMap.get('session_id')?.trim() ?? '';
    const orderId = stored?.orderId ?? '';
    const confirmationToken = stored?.confirmationToken ?? '';
    if (!sessionId && (!orderId || !confirmationToken)) {
      this.error.set('This confirmation link is incomplete. Please contact support if you need help.');
      this.loading.set(false);
      return;
    }
    if (!this.supabase.configured) {
      this.error.set('Order confirmation is temporarily unavailable.');
      this.loading.set(false);
      return;
    }

    const params = new URLSearchParams();
    if (sessionId) {
      params.set('session_id', sessionId);
    } else {
      params.set('order_id', orderId);
      params.set('confirmation_token', confirmationToken);
    }
    const url = `${this.supabase.functionsUrl}/order-status?${params.toString()}`;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const response = await fetch(url, {
          headers: {
            apikey: this.supabase.supabaseAnonKey,
            Authorization: `Bearer ${this.supabase.supabaseAnonKey}`,
          },
        });
        if (response.ok) {
          const result = (await response.json()) as ConfirmationOrder;
          if (!result.orderId || !result.orderNumber) {
            throw new Error('The confirmation response was incomplete.');
          }
          this.order.set(result);
          this.total.set(Number(result.totalCents ?? 0));
          this.currency.set(result.currency || 'usd');
          this.loading.set(false);
          return;
        }
        if (response.status !== 404 && response.status !== 503) {
          throw new Error('The confirmation service returned an error.');
        }
      } catch (error) {
        if (attempt === 4) {
          this.error.set('We could not verify this order yet. Please try again in a moment or contact support.');
          this.loading.set(false);
          return;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    this.error.set('We could not verify this order yet. Please try again in a moment or contact support.');
    this.loading.set(false);
  }

  private readStoredOrder(): { orderId: string; confirmationToken: string } | null {
    try {
      const raw = globalThis.sessionStorage?.getItem('zaraya-last-order');
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { orderId?: string; confirmationToken?: string };
      if (!parsed.orderId || !parsed.confirmationToken) return null;
      return { orderId: parsed.orderId, confirmationToken: parsed.confirmationToken };
    } catch {
      return null;
    }
  }
}
