import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { formatCents, formatDate, AdminOrderRow } from '../models';

@Component({
  selector: 'admin-dashboard-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="admin-stats">
      <div class="admin-stat">
        <strong>{{ stats().products }}</strong>
        <span>Products</span>
      </div>
      <div class="admin-stat">
        <strong>{{ stats().orders }}</strong>
        <span>Total orders</span>
      </div>
      <div class="admin-stat">
        <strong>{{ stats().revenue }}</strong>
        <span>Revenue (paid)</span>
      </div>
      <div class="admin-stat">
        <strong>{{ stats().pending }}</strong>
        <span>Pending orders</span>
      </div>
    </div>

    <div class="admin-flex-between">
      <h2 style="margin:0">Recent orders</h2>
      <a class="admin-btn admin-btn-secondary" routerLink="/admin/orders">View all</a>
    </div>

    @if (loading()) {
      <div class="admin-loading">Loading…</div>
    } @else if (recent().length === 0) {
      <div class="admin-empty">No orders yet. When customers check out, orders appear here.</div>
    } @else {
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Order</th>
              <th>Email</th>
              <th>Status</th>
              <th>Total</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            @for (order of recent(); track order.id) {
              <tr>
                <td><a [routerLink]="['/admin/orders', order.id]">{{ order.order_number }}</a></td>
                <td>{{ order.email || '—' }}</td>
                <td><span class="admin-badge" [class]="order.status">{{ order.status }}</span></td>
                <td>{{ formatCents(order.total_cents, order.currency) }}</td>
                <td>{{ formatDate(order.created_at) }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminDashboardPage {
  private readonly supabase = inject(SupabaseService);

  readonly loading = signal(true);
  readonly recent = signal<AdminOrderRow[]>([]);
  readonly stats = signal({ products: 0, orders: 0, revenue: '-', pending: 0 });
  readonly formatCents = formatCents;
  readonly formatDate = formatDate;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const client = this.supabase.supabase;
      const [
        { count: productCount },
        { count: orderCount },
        paidRes,
        pendingRes,
        recentRes,
      ] = await Promise.all([
        client.from('products').select('*', { count: 'exact', head: true }),
        client.from('orders').select('*', { count: 'exact', head: true }),
        client.from('orders').select('total_cents, currency').eq('status', 'paid'),
        client
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending', 'cod_pending']),
        client.from('orders').select('*').order('created_at', { ascending: false }).limit(6),
      ]);

      let revenue = 0;
      let currency = 'usd';
      const paidOrders = (paidRes.data ?? []) as {
        total_cents: number;
        currency: string;
      }[];
      for (const order of paidOrders) {
        revenue += order.total_cents;
        currency = order.currency;
      }

      this.recent.set((recentRes.data ?? []) as AdminOrderRow[]);
      this.stats.set({
        products: productCount ?? 0,
        orders: orderCount ?? 0,
        revenue: formatCents(revenue, currency),
        pending: pendingRes.count ?? 0,
      });
    } catch (error) {
      console.error('Dashboard failed', error);
    } finally {
      this.loading.set(false);
    }
  }
}