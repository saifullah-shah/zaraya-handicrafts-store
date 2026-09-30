import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../services/supabase.service';
import {
  AdminOrder,
  AdminOrderItem,
  ORDER_STATUSES,
  formatCents,
  formatDate,
  nextStatusesFor,
} from '../../models';

@Component({
  selector: 'admin-order-detail-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  template: `
    <div class="admin-page-head">
      <a class="admin-link admin-muted" routerLink="/admin/orders">&larr; Back to orders</a>
      @if (order()) {
        <span class="admin-badge" [class]="order()!.status">{{ order()!.status }}</span>
      }
    </div>

    @if (loading()) {
      <div class="admin-loading">Loading order&hellip;</div>
    } @else if (error()) {
      <div class="admin-empty">{{ error() }}</div>
    } @else if (order()) {
      <div class="admin-card">
        <h2 style="margin-top:0">{{ order()!.orderNumber }}</h2>
        <dl class="admin-dl">
          <dt>Email</dt>
          <dd>{{ order()!.email || '&mdash;' }}</dd>
          <dt>Placed</dt>
          <dd>{{ formatDate(order()!.createdAt) }}</dd>
          <dt>Payment method</dt>
          <dd>{{ order()!.paymentMethod }}</dd>
          <dt>Status</dt>
          <dd>
            @if (availableStatuses().length > 0) {
              <select
                [ngModel]="status()"
                (ngModelChange)="updateStatus($event)"
                name="status"
                style="padding:.4rem .7rem;border-radius:8px;border:1px solid rgba(0,0,0,.2)"
                [disabled]="saving()"
              >
                @for (option of availableStatuses(); track option) {
                  <option [value]="option">{{ option }}</option>
                }
              </select>
            } @else {
              <span>{{ status() }}</span>
            }
            @if (saving()) {
              <span class="admin-muted" style="margin-left:.5rem">Saving&hellip;</span>
            }
            @if (statusNotice()) {
              <span class="admin-muted" style="display:block;margin-top:.35rem">{{ statusNotice() }}</span>
            }
          </dd>
        </dl>

        <h3>Shipping address</h3>
        <address style="font-style:normal;line-height:1.7">
          @for (line of addressLines; track line) {
            <span style="display:block">{{ line }}</span>
          }
        </address>
      </div>

      <div class="admin-card">
        <h2 style="margin-top:0">Items</h2>
        @if (items().length === 0) {
          <p class="admin-muted">No items recorded for this order.</p>
        } @else {
          <table class="admin-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Qty</th>
                <th>Options</th>
                <th>Gift</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track item.id) {
                <tr>
                  <td>{{ item.productName }}</td>
                  <td>{{ item.quantity }}</td>
                  <td>{{ item.color }}{{ item.size ? ' &middot; ' + item.size : '' }}</td>
                  <td>{{ item.giftPackaging ? 'Yes' : '&mdash;' }}</td>
                  <td style="text-align:right">{{ formatCents(item.unitPriceCents * item.quantity, order()!.currency) }}</td>
                </tr>
              }
            </tbody>
          </table>
        }

        <dl class="admin-dl" style="margin-top:1.25rem;border-top:1px solid var(--admin-border, #e6ded2);padding-top:1rem">
          <dt>Subtotal</dt>
          <dd>{{ formatCents(order()!.subtotalCents, order()!.currency) }}</dd>
          <dt>Gift packaging</dt>
          <dd>{{ formatCents(order()!.giftPackagingCents, order()!.currency) }}</dd>
          <dt>Shipping</dt>
          <dd>{{ formatCents(order()!.shippingCents, order()!.currency) }}</dd>
          <dt style="font-weight:700;font-size:1.05rem">Total</dt>
          <dd style="font-weight:700;font-size:1.05rem">{{ formatCents(order()!.totalCents, order()!.currency) }}</dd>
        </dl>
      </div>
    }
  `,
  styles: [
    `
      .admin-dl {
        display: grid;
        grid-template-columns: 180px 1fr;
        gap: 0.4rem 0;
        margin: 0 0 1rem;
        font-size: 0.92rem;
      }
      .admin-dl dt {
        color: #8a7a66;
      }
      .admin-dl dd {
        margin: 0;
      }
      .admin-page-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.25rem;
      }
      .admin-card {
        background: #fffdf8;
        border: 1px solid var(--admin-border, #e6ded2);
        border-radius: 14px;
        padding: 1.25rem;
        margin-bottom: 1.25rem;
      }
      .admin-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.92rem;
      }
      .admin-table th,
      .admin-table td {
        text-align: left;
        padding: 0.5rem 0.65rem;
        border-bottom: 1px solid var(--admin-border, #e6ded2);
      }
      .admin-table th {
        color: #8a7a66;
        font-weight: 600;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.03em;
      }
      .admin-muted {
        color: #8a7a66;
        font-size: 0.85rem;
      }
    `,
  ],
})
export class AdminOrderDetailPage {
  private readonly supabase = inject(SupabaseService);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly order = signal<AdminOrder | null>(null);
  readonly items = signal<AdminOrderItem[]>([]);
  readonly status = signal('');
  readonly statusNotice = signal('');
  readonly availableStatuses = computed(() => {
    const current = this.status();
    return current ? nextStatusesFor(current) : [];
  });
  readonly ORDER_STATUSES = ORDER_STATUSES;
  readonly formatCents = formatCents;
  readonly formatDate = formatDate;

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) void this.load(id);
    else {
      this.error.set('Missing order id.');
      this.loading.set(false);
    }
  }

  get addressLines(): string[] {
    const address = this.order()?.shippingAddress ?? {};
    const name = address['fullName'] ?? address['full_name'] ?? address['name'] ?? '';
    const street = address['street'] ?? address['address1'] ?? address['address_line1'] ?? '';
    const line2 = address['line2'] ?? address['address2'] ?? '';
    const region = [address['state'] ?? address['region'] ?? '', address['city'] ?? address['city_name'] ?? '']
      .filter(Boolean)
      .join(', ');
    const postal = address['postalCode'] ?? address['postal_code'] ?? address['zip'] ?? '';
    const country = address['country'] ?? '';
    const locality = [postal, country].filter(Boolean).join(' ');
    return [name, street, line2, region, locality].filter(Boolean);
  }

  private async load(id: string): Promise<void> {
    try {
      const { data, error } = await this.supabase.supabase
        .from('orders')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      const row = data as Record<string, unknown>;
      this.order.set({
        id: String(row['id'] ?? ''),
        orderNumber: String(row['order_number'] ?? ''),
        email: String(row['customer_email'] ?? row['email'] ?? ''),
        status: String(row['status'] ?? ''),
        paymentMethod: String(row['payment_method'] ?? ''),
        currency: String(row['currency'] ?? 'usd'),
        subtotalCents: Number(row['subtotal_cents'] ?? 0),
        giftPackagingCents: Number(row['gift_packaging_cents'] ?? 0),
        shippingCents: Number(row['shipping_cents'] ?? 0),
        totalCents: Number(row['total_cents'] ?? 0),
        shippingAddress: (row['shipping_address'] as Record<string, string>) ?? {},
        stripeSessionId: row['stripe_session_id'] ? String(row['stripe_session_id']) : '',
        createdAt: String(row['created_at'] ?? ''),
        items: [],
      });
      this.status.set(this.order()!.status);

      const { data: itemData, error: itemError } = await this.supabase.supabase
        .from('order_items')
        .select('*')
        .eq('order_id', id);
      if (itemError) throw new Error(itemError.message);
      this.items.set(
        ((itemData ?? []) as Record<string, unknown>[]).map((item) => ({
          id: String(item['id'] ?? ''),
          productName: String(item['product_name'] ?? ''),
          quantity: Number(item['quantity'] ?? 1),
          color: String(item['color'] ?? ''),
          size: String(item['size'] ?? ''),
          giftPackaging: Boolean(item['gift_packaging'] ?? false),
          unitPriceCents: Number(item['unit_price_cents'] ?? 0),
        })),
      );
    } catch (loadError) {
      console.error(loadError);
      this.error.set('Could not load order: ' + (loadError as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async updateStatus(next: string): Promise<void> {
    const order = this.order();
    if (!order || this.saving()) return;
    this.status.set(next);
    this.statusNotice.set('');
    this.saving.set(true);
    try {
      const { data, error } = await this.supabase.supabase.rpc('transition_order_status', {
        p_order_id: order.id,
        p_next_status: next,
      });
      if (error) throw new Error(error.message);
      const result = (data ?? {}) as { status?: string; released?: boolean };
      const applied = result.status ?? next;
      this.order.set({ ...order, status: applied });
      this.status.set(applied);
      this.statusNotice.set(
        applied === 'cancelled' || applied === 'refunded'
          ? result.released
            ? `Stock returned to inventory.`
            : `No stock was reserved for this order.`
          : '',
      );
    } catch (loadError) {
      this.status.set(order.status);
      console.error(loadError);
      this.statusNotice.set('Could not update status: ' + (loadError as Error).message);
    } finally {
      this.saving.set(false);
    }
  }
}
