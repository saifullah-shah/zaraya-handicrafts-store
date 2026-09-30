import { Injectable } from '@angular/core';
import { Product } from '../models/store';

declare global {
  interface Window {
    __ZARAYA_PEXELS_KEY__?: string;
  }
}

interface PexelsPhoto {
  id: number;
  alt: string;
  photographer: string;
  photographer_url: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
  };
}

interface PexelsSearchResponse {
  photos: PexelsPhoto[];
}

@Injectable({ providedIn: 'root' })
export class PexelsService {
  private readonly apiKey =
    typeof window === 'undefined' ? '' : (window.__ZARAYA_PEXELS_KEY__ ?? '');
  readonly enabled = this.apiKey.length > 0;
  private readonly cache = new Map<string, string[]>();

  async imagesForProduct(product: Product, count = 3): Promise<string[]> {
    if (!this.enabled) {
      return [];
    }
    const cached = this.cache.get(product.slug);
    if (cached) {
      return cached;
    }
    const name = product.name.replace(/^Zaraya\s+/i, '');
    const urls = await this.search(`${name} bracelet jewelry`, count);
    this.cache.set(product.slug, urls);
    return urls;
  }

  private async search(query: string, perPage: number): Promise<string[]> {
    try {
      const url =
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}` +
        `&per_page=${perPage}&orientation=landscape`;
      const response = await fetch(url, {
        headers: { Authorization: this.apiKey },
      });
      if (!response.ok) {
        console.warn(`Zaraya: Pexels request failed (${response.status}).`);
        return [];
      }
      const data = (await response.json()) as PexelsSearchResponse;
      return (data.photos ?? [])
        .slice(0, perPage)
        .map((photo) => photo.src.large2x || photo.src.large || photo.src.original);
    } catch (error) {
      console.warn('Zaraya: Pexels images unavailable.', error);
      return [];
    }
  }
}