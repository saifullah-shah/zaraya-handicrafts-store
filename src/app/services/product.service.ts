import { Injectable } from '@angular/core';
import { products } from '../data/products';
import { Product } from '../models/store';

@Injectable({ providedIn: 'root' })
export class ProductService {
  getProducts(): Product[] {
    return products;
  }

  getProduct(slug: string): Product | undefined {
    return products.find((product) => product.slug === slug);
  }

  getFeaturedProducts(): Product[] {
    return products.slice(0, 3);
  }
}
