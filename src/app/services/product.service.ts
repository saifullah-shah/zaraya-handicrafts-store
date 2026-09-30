import { Injectable, signal } from '@angular/core';
import { products as staticProducts } from '../data/products';
import { Product } from '../models/store';
import { SupabaseService } from './supabase.service';
import { PexelsService } from './pexels.service';

interface ProductRow {
  id: string;
  slug: string;
  name: string;
  price: number;
  price_cents?: number | null;
  compare_at_price: number | null;
  compare_at_price_cents?: number | null;
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
  sku?: string | null;
  is_active?: boolean;
  archived_at?: string | null;
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  readonly products = signal<Product[]>(staticProducts);
  readonly productsLoaded = signal(false);
  readonly catalogError = signal('');

  private readonly readyPromise: Promise<void>;

  constructor(supabase: SupabaseService, pexels: PexelsService) {
    this.readyPromise = this.init(supabase, pexels);
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  private async init(supabase: SupabaseService, pexels: PexelsService): Promise<void> {
    if (supabase.configured) {
      await this.loadFromSupabase(supabase);
    } else {
      this.productsLoaded.set(true);
    }
    if (pexels.enabled) {
      await this.hydrateImages(pexels);
    }
  }

  getProducts(): Product[] {
    return this.products();
  }

  getProduct(slug: string): Product | undefined {
    return this.products().find((product) => product.slug === slug);
  }

  getProductById(id: string): Product | undefined {
    return this.products().find((product) => product.id === id);
  }

  private async loadFromSupabase(supabase: SupabaseService): Promise<void> {
    try {
      const { data, error } = await supabase.supabase
        .from('products')
        .select('*')
        .order('created_at');
      if (error) {
        throw new Error(error.message);
      }
      this.products.set(
        ((data ?? []) as ProductRow[])
          .filter((row) => row.is_active !== false && !row.archived_at)
          .map(this.mapRow),
      );
      this.catalogError.set('');
    } catch (error) {
      this.products.set([]);
      this.catalogError.set('The collection is temporarily unavailable. Please try again shortly.');
      console.error('Zaraya: Supabase catalog unavailable.', error);
    } finally {
      this.productsLoaded.set(true);
    }
  }

  private async hydrateImages(pexels: PexelsService): Promise<void> {
    try {
      const hydrated = await Promise.all(
        this.products().map(async (product) => {
          const urls = await pexels.imagesForProduct(product);
          return urls.length > 0 ? { ...product, images: urls } : product;
        }),
      );
      this.products.set(hydrated);
    } catch (error) {
      console.warn('Zaraya: Pexels images unavailable, keeping catalog images.', error);
    }
  }

  private mapRow(row: ProductRow): Product {
    const priceCents = Number(row.price_cents ?? Math.round(row.price * 100));
    const compareAtPriceCents = row.compare_at_price_cents ?? (row.compare_at_price === null ? null : Math.round(row.compare_at_price * 100));
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      price: priceCents / 100,
      priceCents,
      compareAtPrice: compareAtPriceCents === null ? undefined : compareAtPriceCents / 100,
      rating: row.rating,
      reviews: row.reviews,
      badge: row.badge,
      category: row.category,
      materials: row.materials,
      description: row.description,
      longDescription: row.long_description,
      images: row.images,
      colors: row.colors,
      sizes: row.sizes,
      stock: row.stock,
      giftPackaging: row.gift_packaging,
      details: row.details,
      sku: row.sku ?? undefined,
      isActive: row.is_active ?? true,
    };
  }
}
