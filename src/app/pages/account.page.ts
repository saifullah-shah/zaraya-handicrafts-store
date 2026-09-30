import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CustomerAuthService } from '../services/customer-auth.service';
import { SupabaseService } from '../services/supabase.service';

interface AccountOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  totalCents: number;
  currency: string;
  createdAt: string;
  items: AccountOrderItem[];
}

interface AccountOrderItem {
  orderId: string;
  productName: string;
  quantity: number;
  color: string;
  size: string;
}

@Component({
  selector: 'app-account-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="container account-page">
      <div class="account-head">
        <div>
          <p class="eyebrow">Your account</p>
          <h1>Orders</h1>
        </div>
        @if (auth.user(); as user) {
          <button type="button" class="button button-secondary" (click)="signOut()">Sign out</button>
        }
      </div>

      @if (!auth.ready()) {
        <p class="admin-muted">Loading your account…</p>
      } @else if (!auth.user()) {
        <div class="panel empty-state">
          <h2>Sign in to see your orders</h2>
          <p>Your order history is available after signing in.</p>
          <a routerLink="/login" class="button button-primary">Sign in</a>
        </div>
      } @else if (loading()) {
        <p class="admin-muted">Loading orders…</p>
      } @else if (error()) {
        <p class="error-text">{{ error() }}</p>
      } @else if (orders().length === 0) {
        <div class="panel empty-state">
          <h2>No orders yet</h2>
          <p>When you place an order, it will appear here.</p>
          <a routerLink="/" class="button button-primary">Continue shopping</a>
        </div>
      } @else {
        <div class="account-orders">
          @for (order of orders(); track order.id) {
            <article class="panel account-order">
              <div class="account-order-head">
                <div>
                  <strong>{{ order.orderNumber }}</strong>
                  <span class="admin-muted">Placed {{ formatDate(order.createdAt) }}</span>
                </div>
                <span class="admin-badge" [class]="order.status">{{ order.status }}</span>
              </div>
              <div class="account-order-lines">
                @for (item of order.items; track item.orderId + item.productName + item.color + item.size) {
                  <span>{{ item.productName }} × {{ item.quantity }}</span>
                }
              </div>
              <strong>{{ formatCents(order.totalCents, order.currency) }}</strong>
            </article>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .account-page { padding: 4rem 0 6rem; }
      .account-head { display: flex; justify-content: space-between; align-items: end; gap: 1rem; margin-bottom: 2rem; }
      .account-head h1 { margin: 0; }
      .account-orders { display: grid; gap: 1rem; }
      .account-order { display: grid; gap: 1rem; }
      .account-order-head { display: flex; justify-content: space-between; gap: 1rem; }
      .account-order-head > div { display: grid; gap: .3rem; }
      .account-order-lines { display: grid; gap: .35rem; color: #8a7a66; }
      .admin-muted { color: #8a7a66; font-size: .9rem; }
      .admin-badge { border-radius: 999px; padding: .3rem .6rem; background: #f1e9de; font-size: .8rem; }
      .error-text { color: #a33d35; }
    `,
  ],
})
export class AccountPage {
  readonly auth = inject(CustomerAuthService);
  private readonly supabase = inject(SupabaseService);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly orders = signal<AccountOrder[]>([]);

  constructor() {
    void this.loadWhenReady();
  }

  async signOut(): Promise<void> {
    await this.auth.signOut();
    this.orders.set([]);
  }

  formatCents(cents: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: (currency || 'usd').toUpperCase(),
    }).format(cents / 100);
  }

  formatDate(value: string): string {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
  }

  private async loadWhenReady(): Promise<void> {
    if (!this.auth.ready()) {
      await this.auth.init();
    }
    const user = this.auth.user();
    if (!user) {
      this.loading.set(false);
      return;
    }
    try {
      const client = this.supabase.supabase;
      const columns = 'id, order_number, status, payment_method, total_cents, currency, created_at';
      const { data: orderData, error: orderError } = await client
        .from('orders')
        .select(columns)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (orderError) throw new Error(orderError.message);
      const orders = (orderData ?? []) as Array<Record<string, unknown>>;
      const ids = orders.map((order) => String(order['id']));
      const { data: itemData, error: itemError } = ids.length
        ? await client.from('order_items').select('order_id, product_name, quantity, color, size').in('order_id', ids)
        : { data: [], error: null };
      if (itemError) throw new Error(itemError.message);
      const items = (itemData ?? []) as Array<Record<string, unknown>>;
      this.orders.set(
        orders.map((order) => ({
          id: String(order['id']),
          orderNumber: String(order['order_number'] ?? ''),
          status: String(order['status'] ?? ''),
          paymentMethod: String(order['payment_method'] ?? ''),
          totalCents: Number(order['total_cents'] ?? 0),
          currency: String(order['currency'] ?? 'usd'),
          createdAt: String(order['created_at'] ?? ''),
          items: items
            .filter((item) => String(item['order_id']) === String(order['id']))
            .map((item) => ({
              orderId: String(item['order_id']),
              productName: String(item['product_name'] ?? ''),
              quantity: Number(item['quantity'] ?? 1),
              color: String(item['color'] ?? ''),
              size: String(item['size'] ?? ''),
            })),
        })),
      );
    } catch (loadError) {
      this.error.set('Could not load your orders: ' + (loadError as Error).message);
    } finally {
      this.loading.set(false);
    }
  }
}
