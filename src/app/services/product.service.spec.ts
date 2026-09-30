import { TestBed } from '@angular/core/testing';
import { ProductService } from './product.service';
import { SupabaseService } from './supabase.service';
import { PexelsService } from './pexels.service';

interface RowResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

class SupabaseStub {
  configured = true;
  result: RowResult = { data: [], error: null };
  orders: string[] = [];

  readonly supabase = {
    from: (table: string) => {
      this.orders.push(table);
      return {
        select: () => ({
          order: (column: string) => {
            this.orders.push(column);
            return Promise.resolve(this.result);
          },
        }),
      };
    },
  };
}

class PexelsStub {
  enabled = false;
  imagesForProduct = () => Promise.resolve<string[]>([]);
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    slug: 'p1',
    name: 'Product One',
    price: 148,
    price_cents: 14800,
    compare_at_price: null,
    compare_at_price_cents: null,
    rating: 4.9,
    reviews: 10,
    badge: 'Best Seller',
    category: 'Jewelry',
    materials: ['gold'],
    description: 'desc',
    long_description: 'long',
    images: ['a.jpg'],
    colors: ['Gold'],
    sizes: ['S'],
    stock: 5,
    gift_packaging: true,
    details: ['one'],
    sku: 'SKU-1',
    is_active: true,
    archived_at: null,
    ...overrides,
  };
}

async function buildService(result: RowResult): Promise<ProductService> {
  const supabase = new SupabaseStub();
  supabase.result = result;
  TestBed.configureTestingModule({
    providers: [
      ProductService,
      { provide: SupabaseService, useValue: supabase },
      { provide: PexelsService, useClass: PexelsStub },
    ],
  });
  const service = TestBed.inject(ProductService);
  await service.ready();
  return service;
}

describe('ProductService catalog loading', () => {
  it('reads the products table ordered by created_at', async () => {
    const service = await buildService({ data: [makeRow()], error: null });
    const supabase = TestBed.inject(SupabaseService) as unknown as SupabaseStub;
    expect(supabase.orders).toEqual(['products', 'created_at']);
    expect(service.productsLoaded()).toBe(true);
    expect(service.catalogError()).toBe('');
  });

  it('prefers price_cents over the legacy dollar column', async () => {
    const service = await buildService({
      data: [makeRow({ price: 148, price_cents: 13900 })],
      error: null,
    });
    const product = service.getProducts()[0];
    expect(product.priceCents).toBe(13900);
    expect(product.price).toBe(139);
  });

  it('falls back to price * 100 when price_cents is null', async () => {
    const service = await buildService({
      data: [makeRow({ price: 136, price_cents: null })],
      error: null,
    });
    expect(service.getProducts()[0].priceCents).toBe(13600);
  });

  it('leaves compareAtPrice undefined when there is no compare-at price', async () => {
    const service = await buildService({ data: [makeRow()], error: null });
    expect(service.getProducts()[0].compareAtPrice).toBeUndefined();
  });

  it('converts compare_at_price_cents when present', async () => {
    const service = await buildService({
      data: [makeRow({ compare_at_price: 180, compare_at_price_cents: 18000 })],
      error: null,
    });
    expect(service.getProducts()[0].compareAtPrice).toBe(180);
  });

  it('hides products that are not active', async () => {
    const service = await buildService({
      data: [makeRow({ id: 'live' }), makeRow({ id: 'hidden', slug: 'hidden', is_active: false })],
      error: null,
    });
    expect(service.getProducts().map((p) => p.id)).toEqual(['live']);
  });

  it('hides archived products', async () => {
    const service = await buildService({
      data: [
        makeRow({ id: 'live' }),
        makeRow({ id: 'old', slug: 'old', archived_at: '2026-01-01' }),
      ],
      error: null,
    });
    expect(service.getProducts().map((p) => p.id)).toEqual(['live']);
  });

  it('returns every active, unarchived product with no arbitrary cap', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => makeRow({ id: `p${i}`, slug: `p${i}` }));
    const service = await buildService({ data: rows, error: null });
    expect(service.getProducts().length).toBe(12);
  });

  it('maps long_description and gift_packaging onto the Product shape', async () => {
    const service = await buildService({ data: [makeRow()], error: null });
    const product = service.getProducts()[0];
    expect(product.longDescription).toBe('long');
    expect(product.giftPackaging).toBe(true);
    expect(product.sku).toBe('SKU-1');
  });

  it('finds a product by slug and by id', async () => {
    const service = await buildService({ data: [makeRow()], error: null });
    expect(service.getProduct('p1')?.name).toBe('Product One');
    expect(service.getProductById('p1')?.slug).toBe('p1');
    expect(service.getProduct('nope')).toBeUndefined();
  });

  it('empties the catalog and surfaces a message when the query fails', async () => {
    const service = await buildService({ data: null, error: { message: 'boom' } });
    expect(service.getProducts()).toEqual([]);
    expect(service.catalogError()).toContain('temporarily unavailable');
    expect(service.productsLoaded()).toBe(true);
  });

  it('renders an empty grid without error when there are no products', async () => {
    const service = await buildService({ data: [], error: null });
    expect(service.getProducts()).toEqual([]);
    expect(service.catalogError()).toBe('');
  });
});
