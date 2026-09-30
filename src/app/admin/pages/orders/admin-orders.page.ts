import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../../services/supabase.service';
import { AdminOrder, AdminOrderRow, formatCents, formatDate } from '../../models';

function toOrder(row: AdminOrderRow): AdminOrder {
  return {
    id: row.id,
    orderNumber: row.order_number,
    email: row.email,
    status: row.status,
    paymentMethod: row.payment_method,
    currency: row.currency,
    subtotalCents: row.subtotal_cents,
    giftPackagingCents: row.gift_packaging_cents,
    shippingCents: row.shipping_cents,
    totalCents: row.total_cents,
    shippingAddress: row.shipping_address ?? {},
    stripeSessionId: row.stripe_session_id ?? '',
    createdAt: row.created_at,
    items: [],
  };
}

@Component({
  selector: 'admin-orders-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="admin-flex-between">
      <p class="admin-muted">{{ orders().length }} orders</p>
      <div style="display:flex;gap:.5rem">
        <select
          aria-label="Filter orders by status"
          style="padding:.5rem .7rem;border-radius:10px;border:1px solid rgba(34,30,28,.18)"
          [value]="filter()"
          (change)="setFilter($event)"
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="cod_pending">Cash on delivery</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>

    @if (loading()) {
      <div class="admin-loading">Loading orders…</div>
    } @else if (error()) {
      <div class="admin-empty">{{ error() }}</div>
    } @else if (orders().length === 0) {
      <div class="admin-empty">No orders to show.</div>
    } @else {
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Email</th>
              <th>Payment</th>
              <th>Status</th>
              <th>Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            @for (order of filtered(); track order.id) {
              <tr>
                <td><a [routerLink]="['/admin/orders', order.id]">{{ order.orderNumber }}</a></td>
                <td>{{ order.email || '—' }}</td>
                <td>{{ order.paymentMethod }}</td>
                <td><span class="admin-badge" [class]="order.status">{{ order.status }}</span></td>
                <td>{{ formatCents(order.totalCents, order.currency) }}</td>
                <td>{{ formatDate(order.createdAt) }}</td>
              </tr>
            }
          </tbody>
          </table>
          @if (pageCount() > 1) {
            <div class="admin-pagination">
              <button type="button" class="admin-btn admin-btn-secondary" [disabled]="page() === 0" (click)="goToPage(page() - 1)">
                Previous
              </button>
              <span class="admin-muted">Page {{ page() + 1 }} of {{ pageCount() }} · {{ total() }} orders</span>
              <button type="button" class="admin-btn admin-btn-secondary" [disabled]="page() + 1 >= pageCount()" (click)="goToPage(page() + 1)">
                Next
              </button>
            </div>
          }
        </div>

    }
  `,
})
export class AdminOrdersPage {
  private readonly supabase = inject(SupabaseService);

  readonly loading = signal(true);
  readonly orders = signal<AdminOrder[]>([]);
  readonly allOrders = signal<AdminOrder[]>([]);
  readonly filter = signal('all');
  readonly filtered = signal<AdminOrder[]>([]);
  readonly error = signal('');
  readonly page = signal(0);
  readonly total = signal(0);
  readonly pageSize = signal(25);
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  readonly formatCents = formatCents;
  readonly formatDate = formatDate;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const from = this.page() * this.pageSize();
      const to = from + this.pageSize() - 1;
      const { data, error, count } = await this.supabase.supabase
        .from('orders')
        .select(
          'id, order_number, email, status, payment_method, currency, subtotal_cents, gift_packaging_cents, shipping_cents, total_cents, shipping_address, stripe_session_id, created_at',
          { count: 'exact' },
        )
        .order('created_at', { ascending: false })
        .range(from, to);
      if (error) throw new Error(error.message);
      this.allOrders.set(((data ?? []) as AdminOrderRow[]).map(toOrder));
      this.total.set(count ?? 0);
      this.applyFilter(this.filter());
    } catch (error) {
      console.error('Could not load orders', error);
      this.error.set('Could not load orders: ' + (error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  goToPage(offset: number): void {
    const next = Math.max(0, Math.min(this.pageCount() - 1, offset));
    if (next === this.page()) return;
    this.page.set(next);
    this.loading.set(true);
    void this.load();
  }

  setFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.applyFilter(value);
  }

  private applyFilter(value: string): void {
    this.filter.set(value);
    const rows = value === 'all'
      ? this.allOrders()
      : this.allOrders().filter((order) => order.status === value);
    this.orders.set(rows);
    this.filtered.set(rows);
  }
}