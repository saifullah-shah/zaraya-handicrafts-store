import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SupabaseService } from '../../../services/supabase.service';
import { formatCents } from '../../models';

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  price: number;
  compare_at_price: number | null;
  rating: number;
  reviews: number;
  badge: string;
  category: string;
  materials: string[];
  description: string;
  long_description: string;
  images: string[];
  colors: string[];
  sizes: string[];
  stock: number;
  gift_packaging: boolean;
  details: string[];
  created_at?: string;
}

interface ProductView {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  images: string[];
}

@Component({
  selector: 'admin-products-page',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="admin-flex-between">
      <p class="admin-muted">{{ products().length }} products in the catalog</p>
      <a class="admin-btn admin-btn-primary" routerLink="/admin/products/new">＋ New product</a>
    </div>

    @if (loading()) {
      <div class="admin-loading">Loading products…</div>
    } @else if (products().length === 0) {
      <div class="admin-empty">No products yet. Create your first product.</div>
    } @else {
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (product of products(); track product.id) {
              <tr>
                <td>
                  <a [routerLink]="['/admin/products', product.id]">
                    <span style="display:flex;align-items:center;gap:.7rem">
                      <img
                        [src]="product.images[0]"
                        alt=""
                        width="44"
                        height="44"
                        style="border-radius:8px;object-fit:cover"
                      />
                      <span>{{ product.name }}</span>
                    </span>
                  </a>
                </td>
                <td>{{ product.category || '—' }}</td>
                <td>{{ formatCents(product.price * 100) }}</td>
                <td>{{ product.stock }}</td>
                <td>
                  <span class="admin-badge" [class]="product.stock > 0 ? 'paid' : 'cancelled'">
                    {{ product.stock > 0 ? 'In stock' : 'Out of stock' }}
                  </span>
                </td>
                <td>
                  <button
                    class="admin-btn admin-btn-danger admin-btn-sm"
                    (click)="remove(product)"
                    aria-label="Delete {{ product.name }}"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
})
export class AdminProductsPage {
  private readonly supabase = inject(SupabaseService);

  readonly loading = signal(true);
  readonly products = signal<ProductView[]>([]);
  readonly formatCents = formatCents;

  constructor() {
    void this.load();
  }

  private async load(): Promise<void> {
    try {
      const { data, error } = await this.supabase.supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      this.products.set(
        (data as ProductRow[]).map((row) => ({
          id: row.id,
          name: row.name,
          category: row.category,
          price: row.price,
          stock: row.stock,
          images: row.images,
        })),
      );
    } catch (error) {
      console.error('Could not load products', error);
      alert('Could not load products: ' + (error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async remove(product: ProductView): Promise<void> {
    if (!window.confirm(`Delete “${product.name}”? This cannot be undone.`)) return;
    const { error } = await this.supabase.supabase
      .from('products')
      .delete()
      .eq('id', product.id);
    if (error) {
      alert('Could not delete: ' + error.message);
      return;
    }
    this.products.set(this.products().filter((p) => p.id !== product.id));
  }
}