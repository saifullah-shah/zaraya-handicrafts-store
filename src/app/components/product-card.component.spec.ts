import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ProductCardComponent } from './product-card.component';
import { Product } from '../models/store';

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    slug: 'zaraya-gold-arc-bracelet',
    name: 'Zaraya Gold Arc Bracelet',
    price: 148,
    rating: 4.9,
    reviews: 236,
    badge: 'Best Seller',
    category: 'Handmade Jewelry',
    materials: ['18k gold vermeil'],
    description: 'A hand-finished arc bracelet.',
    longDescription: 'Long description.',
    images: ['https://example.test/a.jpg', 'https://example.test/b.jpg'],
    colors: ['Champagne Gold'],
    sizes: ['S'],
    stock: 24,
    giftPackaging: true,
    details: ['Hand finished'],
    ...overrides,
  };
}

describe('ProductCardComponent', () => {
  async function create(product: Product = makeProduct()) {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(ProductCardComponent);
    fixture.componentRef.setInput('product', product);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('renders the product name, price and description', async () => {
    const fixture = await create();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h3')?.textContent?.trim()).toBe('Zaraya Gold Arc Bracelet');
    expect(el.querySelector('.price-row strong')?.textContent?.trim()).toBe('$148');
    expect(el.querySelector('.product-meta p')?.textContent?.trim()).toBe(
      'A hand-finished arc bracelet.',
    );
  });

  it('links to the product detail route for both the image and the text link', async () => {
    const fixture = await create();
    const el = fixture.nativeElement as HTMLElement;
    const hrefs = [...el.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/product/zaraya-gold-arc-bracelet');
    expect(hrefs.length).toBe(2);
  });

  it('uses the first image as the card media', async () => {
    const fixture = await create();
    const el = fixture.nativeElement as HTMLElement;
    const img = el.querySelector('img.circular-zoom__media') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('https://example.test/a.jpg');
    expect(img.getAttribute('alt')).toBe('Zaraya Gold Arc Bracelet');
  });

  it('keeps the circular-zoom wrapper as a block box so the image is not collapsed', async () => {
    // Regression: the wrapper used to sit on an inline <span>, so width:100% and
    // aspect-ratio were ignored, the box collapsed to 0x0, overflow:hidden clipped
    // the image away, and the zero-height link could not be clicked.
    const fixture = await create();
    const el = fixture.nativeElement as HTMLElement;
    const zoom = el.querySelector('.circular-zoom') as HTMLElement;
    expect(zoom).toBeTruthy();
    expect(getComputedStyle(zoom).display).toBe('block');
  });

  it('keeps the clickable link visible on screen', async () => {
    const fixture = await create();
    const el = fixture.nativeElement as HTMLElement;
    const link = el.querySelector('a[href]') as HTMLElement;
    expect(getComputedStyle(link).display).toBe('block');
  });

  it('shows the badge only when the product has one', async () => {
    const withBadge = await create();
    expect((withBadge.nativeElement as HTMLElement).querySelector('.badge')).toBeTruthy();

    const without = await create(makeProduct({ badge: '' }));
    expect((without.nativeElement as HTMLElement).querySelector('.badge')).toBeNull();
  });

  it('renders a struck-through compare-at price when one exists', async () => {
    const fixture = await create(makeProduct({ price: 148, compareAtPrice: 180 }));
    const el = fixture.nativeElement as HTMLElement;
    const compare = el.querySelector('.price-row span') as HTMLElement;
    expect(compare.textContent?.trim()).toBe('$180');
  });

  it('leaves the compare-at slot empty when there is no discount', async () => {
    const fixture = await create(makeProduct({ compareAtPrice: undefined }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.price-row span')?.textContent?.trim()).toBe('');
  });
});
