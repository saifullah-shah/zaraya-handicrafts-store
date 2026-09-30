import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../services/supabase.service';
import { AdminContentService } from '../../services/admin-content.service';
import { ImageUploadComponent } from '../../components/image-upload.component';

interface ProductForm {
  id: string;
  slug: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  rating: number;
  reviews: number;
  badge: string;
  category: string;
  materials: string;
  description: string;
  longDescription: string;
  images: string[];
  colors: string;
  sizes: string;
  stock: number;
  giftPackaging: boolean;
  details: string;
  featured: boolean;
}

function emptyForm(): ProductForm {
  return {
    id: '',
    slug: '',
    name: '',
    price: 0,
    compareAtPrice: null,
    rating: 0,
    reviews: 0,
    badge: 'New Arrival',
    category: 'Handmade Jewelry',
    materials: '',
    description: '',
    longDescription: '',
    images: [],
    colors: 'Champagne Gold',
    sizes: 'S, M, L',
    stock: 10,
    giftPackaging: true,
    details: '',
    featured: false,
  };
}

@Component({
  selector: 'admin-product-edit-page',
  standalone: true,
  imports: [FormsModule, RouterLink, ImageUploadComponent],
  template: `
    <div class="admin-flex-between">
      <a class="admin-muted" routerLink="/admin/products">← Back to products</a>
      @if (isEdit()) {
        <span class="admin-badge paid">Editing “{{ form().name }}”</span>
      } @else {
        <span class="admin-badge paid">New product</span>
      }
    </div>

    @if (loading()) {
      <div class="admin-loading">Loading product…</div>
    } @else {
      <form class="admin-form" (ngSubmit)="save()">
        @if (error()) {
          <div class="admin-alert admin-alert-error" role="alert">{{ error() }}</div>
        }
        @if (saved()) {
          <div class="admin-alert admin-alert-success" role="status">Saved successfully.</div>
        }

        <div class="admin-card">
          <h2>Basics</h2>
          <div class="admin-form-row">
            <div class="admin-field">
              <label for="p-name">Name</label>
              <input id="p-name" type="text" [(ngModel)]="form().name" name="name" required />
            </div>
            <div class="admin-field">
              <label for="p-slug">Slug (URL)</label>
              <input
                id="p-slug"
                type="text"
                [(ngModel)]="form().slug"
                name="slug"
                placeholder="auto from name"
              />
            </div>
          </div>

          <div class="admin-form-row">
            <div class="admin-field">
              <label for="p-badge">Badge</label>
              <input id="p-badge" type="text" [(ngModel)]="form().badge" name="badge" />
            </div>
            <div class="admin-field">
              <label for="p-category">Category</label>
              <input
                id="p-category"
                type="text"
                [(ngModel)]="form().category"
                name="category"
              />
            </div>
          </div>

          <div class="admin-form-row">
            <div class="admin-field">
              <label for="p-price">Price (USD)</label>
              <input
                id="p-price"
                type="number"
                min="0"
                step="0.01"
                [(ngModel)]="form().price"
                name="price"
                required
              />
            </div>
            <div class="admin-field">
              <label for="p-compare">Compare-at price (optional)</label>
              <input
                id="p-compare"
                type="number"
                min="0"
                step="0.01"
                [(ngModel)]="form().compareAtPrice"
                name="compare"
              />
            </div>
          </div>

          <div class="admin-form-row">
            <div class="admin-field">
              <label for="p-stock">Stock</label>
              <input
                id="p-stock"
                type="number"
                min="0"
                [(ngModel)]="form().stock"
                name="stock"
              />
            </div>
            <div class="admin-field">
              <label for="p-rating">Rating (0–5)</label>
              <input
                id="p-rating"
                type="number"
                min="0"
                max="5"
                step="0.1"
                [(ngModel)]="form().rating"
                name="rating"
              />
            </div>
          </div>

          <div class="admin-form-row">
            <div class="admin-field">
              <label for="p-reviews">Review count</label>
              <input
                id="p-reviews"
                type="number"
                min="0"
                [(ngModel)]="form().reviews"
                name="reviews"
              />
            </div>
            <div class="admin-field">
              <label class="admin-checkbox" style="padding-top:1.6rem">
                <input type="checkbox" [(ngModel)]="form().giftPackaging" name="gift" />
                Gift packaging available
              </label>
              <label class="admin-checkbox">
                <input type="checkbox" [(ngModel)]="form().featured" name="featured" />
                Featured on homepage
              </label>
            </div>
          </div>
        </div>

        <div class="admin-card">
          <h2>Description</h2>
          <div class="admin-field">
            <label for="p-desc">Short description</label>
            <input
              id="p-desc"
              type="text"
              [(ngModel)]="form().description"
              name="description"
            />
          </div>
          <div class="admin-field">
            <label for="p-long">Long description</label>
            <textarea
              id="p-long"
              [(ngModel)]="form().longDescription"
              name="longDescription"
              rows="4"
            ></textarea>
          </div>
          <div class="admin-field">
            <label for="p-materials">Materials (comma separated)</label>
            <input
              id="p-materials"
              type="text"
              [(ngModel)]="form().materials"
              name="materials"
              placeholder="18k gold vermeil, Brass core"
            />
          </div>
          <div class="admin-field">
            <label for="p-details">Details (one per line)</label>
            <textarea
              id="p-details"
              [(ngModel)]="form().details"
              name="details"
              rows="4"
            ></textarea>
          </div>
        </div>

        <div class="admin-card">
          <h2>Variants</h2>
          <div class="admin-form-row">
            <div class="admin-field">
              <label for="p-colors">Colors (comma separated)</label>
              <input
                id="p-colors"
                type="text"
                [(ngModel)]="form().colors"
                name="colors"
                placeholder="Champagne Gold, Rose Gold"
              />
            </div>
            <div class="admin-field">
              <label for="p-sizes">Sizes (comma separated)</label>
              <input
                id="p-sizes"
                type="text"
                [(ngModel)]="form().sizes"
                name="sizes"
                placeholder="S, M, L"
              />
            </div>
          </div>
        </div>

        <div class="admin-card">
          <h2>Images</h2>
          <p class="admin-muted">
            Upload up to five images. The first becomes the main product photo.
          </p>
          <div style="display:grid;gap:1rem">
            @for (image of form().images; track image; let i = $index) {
              <div class="admin-image-picker">
                <img [src]="image" alt="" />
                <div class="admin-field" style="flex:1">
                  <label [for]="'img-' + i">Image {{ i + 1 }} — URL or path</label>
                  <input
                    [id]="'img-' + i"
                    type="text"
                    [(ngModel)]="form().images[i]"
                    [name]="'image-' + i"
                  />
                </div>
                <button
                  type="button"
                  class="admin-btn admin-btn-danger admin-btn-sm"
                  (click)="removeImage(i)"
                >
                  Remove
                </button>
              </div>
            }

            @if (form().images.length < 5) {
              <image-upload (uploaded)="addImage($event)" />
            }
          </div>
        </div>

        <div class="admin-actions">
          <button type="submit" class="admin-btn admin-btn-primary" [disabled]="busy()">
            {{ busy() ? 'Saving…' : isEdit() ? 'Save changes' : 'Create product' }}
          </button>
          <a class="admin-btn admin-btn-secondary" routerLink="/admin/products">Cancel</a>
        </div>
      </form>
    }
  `,
})
export class AdminProductEditPage {
  private readonly route = inject(ActivatedRoute);
  private readonly supabase = inject(SupabaseService);
  private readonly content = inject(AdminContentService);
  private readonly router = inject(Router);

  readonly isEdit = signal(false);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly uploading = signal(false);
  readonly error = signal('');
  readonly saved = signal(false);
  readonly form = signal<ProductForm>(emptyForm());

  constructor() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEdit.set(true);
      void this.loadProduct(id);
    } else {
      this.loading.set(false);
    }
  }

  private async loadProduct(id: string): Promise<void> {
    try {
      const { data, error } = await this.supabase.supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new Error(error.message);
      const row = data as Record<string, unknown>;
      this.form.set({
        ...emptyForm(),
        ...({
          id: row['id'],
          slug: row['slug'],
          name: row['name'],
          price: Number(row['price_cents'] ?? Number(row['price'] ?? 0) * 100) / 100,
          compareAtPrice:
            row['compare_at_price_cents'] !== null && row['compare_at_price_cents'] !== undefined
              ? Number(row['compare_at_price_cents']) / 100
              : row['compare_at_price'] === null || row['compare_at_price'] === undefined
                ? null
                : Number(row['compare_at_price']),
          rating: Number(row['rating']),
          reviews: Number(row['reviews']),
          badge: row['badge'],
          category: row['category'],
          materials: (row['materials'] as string[]).join(', '),
          description: row['description'],
          longDescription: row['long_description'],
          images: (row['images'] as string[]) ?? [],
          colors: (row['colors'] as string[]).join(', '),
          sizes: (row['sizes'] as string[]).join(', '),
          stock: Number(row['stock']),
          giftPackaging: Boolean(row['gift_packaging']),
          details: (row['details'] as string[]).join('\n'),
          featured: Boolean(row['featured']),
        } as ProductForm),
      });
    } catch (error) {
      this.error.set('Could not load product: ' + (error as Error).message);
    } finally {
      this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    const form = { ...this.form() };
    if (!form.name.trim()) {
      this.error.set('Name is required.');
      return;
    }
    const slug = form.slug.trim() || this.slugify(form.name);
    const images = form.images.filter((url) => url.trim().length > 0);

    this.busy.set(true);
    this.saved.set(false);
    this.error.set('');
    try {
      const { error } = await this.supabase.supabase.from('products').upsert(
        {
          id: form.id || `${slug}`,
          slug,
          name: form.name.trim(),
          price: Math.round(form.price * 100) / 100,
          price_cents: Math.round(form.price * 100),
          compare_at_price:
            form.compareAtPrice === null ? null : Math.round(form.compareAtPrice * 100) / 100,
          compare_at_price_cents:
            form.compareAtPrice === null ? null : Math.round(form.compareAtPrice * 100),
          rating: form.rating ?? 0,
          reviews: form.reviews ?? 0,
          badge: form.badge,
          category: form.category,
          materials: this.splitList(form.materials),
          description: form.description,
          long_description: form.longDescription,
          images,
          colors: this.splitList(form.colors),
          sizes: this.splitList(form.sizes),
          stock: form.stock ?? 0,
          gift_packaging: form.giftPackaging,
          details: form.details.split('\n').map((d) => d.trim()).filter(Boolean),
          featured: form.featured,
        },
        { onConflict: 'id' },
      );
      if (error) throw new Error(error.message);
      this.saved.set(true);
      if (!this.isEdit()) {
        this.form.set({ ...form, id: slug, slug, images });
        this.isEdit.set(true);
      }
      setTimeout(() => this.saved.set(false), 2500);
    } catch (error) {
      this.error.set('Could not save: ' + (error as Error).message);
    } finally {
      this.busy.set(false);
    }
  }

  async addImage(file: File): Promise<void> {
    const form = { ...this.form() };
    this.error.set('');
    if (form.images.length >= 5) {
      this.error.set('Maximum five images.');
      return;
    }
    this.uploading.set(true);
    try {
      const folder = form.id || this.slugify(form.name) || 'products';
      const url = await this.content.uploadImage(file, folder);
      this.form.set({ ...form, images: [...form.images, url] });
    } catch (error) {
      this.error.set('Upload failed: ' + (error as Error).message);
    } finally {
      this.uploading.set(false);
    }
  }

  removeImage(index: number): void {
    const form = { ...this.form() };
    form.images = form.images.filter((_, i) => i !== index);
    this.form.set(form);
  }

  private splitList(value: string): string[] {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}