import { Injectable, signal } from '@angular/core';
import { products as staticProducts } from '../data/products';
import { Product } from '../models/store';
import { SupabaseService } from './supabase.service';

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
}

@Injectable({ providedIn: 'root' })
export class ProductService {
  readonly products = signal<Product[]>(staticProducts);
  readonly productsLoaded = signal(false);

  constructor(supabase: SupabaseService) {
    if (supabase.configured) {
      void this.loadFromSupabase(supabase);
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

  getFeaturedProducts(limit = 3): Product[] {
    return this.products().slice(0, limit);
  }

  private async loadFromSupabase(supabase: SupabaseService): Promise<void> {
    try {
      const { data, error } = await supabase.supabase
        .from('products')
        .select('*')
        .order('created_at');
      if (error) {
        console.warn(
          'Zaraya: could not load products from Supabase, using static catalog.',
          error.message,
        );
        return;
      }
      if (data && data.length > 0) {
        this.products.set((data as ProductRow[]).map(this.mapRow));
      }
    } catch (error) {
      console.warn('Zaraya: Supabase catalog unavailable, using static catalog.', error);
    } finally {
      this.productsLoaded.set(true);
    }
  }

  private mapRow(row: ProductRow): Product {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      price: row.price,
      compareAtPrice: row.compare_at_price ?? undefined,
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
    };
  }
}
