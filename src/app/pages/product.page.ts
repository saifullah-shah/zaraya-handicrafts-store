import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Product } from '../models/store';
import { CartService } from '../services/cart.service';
import { PricingService } from '../services/pricing.service';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-product-page',
  standalone: true,
  imports: [RouterLink, FormsModule],
  template: `
    @if (product) {
      <section class="product-page container">
        <div class="images-column">
          <div class="circular-zoom">
            <span class="circular-zoom__orbit">
              <span class="circular-zoom__stage">
                <img class="circular-zoom__media" [src]="product.images[0]" [alt]="product.name" />
              </span>
            </span>
            <span class="circular-zoom__ring" aria-hidden="true"></span>
          </div>
          <div class="thumb-grid">
            @for (image of product.images; track image) {
              <img [src]="image" [alt]="product.name + ' detail image'" />
            }
          </div>
        </div>

        <div class="details-column">
          <p class="eyebrow">{{ product.category }}</p>
          <h1>{{ product.name }}</h1>

          <div class="rating-row">
            <span>★★★★★</span>
            <span>{{ product.rating }} ({{ product.reviews }} reviews)</span>
          </div>

          <div class="price-row">
            <strong>{{ pricing.formatPrice(product.price) }}</strong>
            <span>{{ product.compareAtPrice ? pricing.formatPrice(product.compareAtPrice) : '' }}</span>
          </div>

          <p class="description">{{ product.description }}</p>

          <div class="variant-group">
            <label>Color</label>
            <div class="option-list">
              @for (color of product.colors; track color) {
                <button
                  type="button"
                  class="option-button"
                  [class.selected]="selectedColor === color"
                  (click)="selectedColor = color"
                >
                  {{ color }}
                </button>
              }
            </div>
          </div>

          <div class="variant-group">
            <label>Size</label>
            <div class="option-list">
              @for (size of product.sizes; track size) {
                <button
                  type="button"
                  class="option-button"
                  [class.selected]="selectedSize === size"
                  (click)="selectedSize = size"
                >
                  {{ size }}
                </button>
              }
            </div>
          </div>

          <div class="purchase-row">
            <div class="quantity-box">
              <button type="button" (click)="decrementQuantity()">−</button>
              <span>{{ quantity }}</span>
              <button type="button" (click)="incrementQuantity()">+</button>
            </div>

            <button type="button" class="button button-primary" (click)="addToCart()">
              Add to cart
            </button>
          </div>

          <label class="gift-toggle">
            <input type="checkbox" [(ngModel)]="giftPackaging" />
            <span>Add gift packaging (+$12)</span>
          </label>

          <div class="meta-box">
            <div><strong>Ships:</strong> 3–5 business days</div>
            <div><strong>Materials:</strong> {{ product.materials.join(', ') }}</div>
            <div><strong>Stock:</strong> {{ product.stock }} available</div>
          </div>
        </div>
      </section>

      <section class="details-grid container">
        <div class="story-panel">
          <h2>Crafted with intention</h2>
          <p>{{ product.longDescription }}</p>
          <ul>
            @for (detail of product.details; track detail) {
              <li>{{ detail }}</li>
            }
          </ul>
        </div>

        <aside class="care-panel">
          <h3>Care instructions</h3>
          <p>Keep away from water and harsh chemicals. Store in the included pouch when not in use.</p>
        </aside>
      </section>
    } @else {
      <section class="container empty-state">
        <h2>Product not found</h2>
        <a routerLink="/" class="button button-primary">Return home</a>
      </section>
    }
  `,
  styleUrl: './product.page.scss',
})
export class ProductPage implements OnInit {
  product: Product | undefined;
  selectedColor = '';
  selectedSize = '';
  quantity = 1;
  giftPackaging = true;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly productService: ProductService,
    private readonly cartService: CartService,
    readonly pricing: PricingService,
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const slug = params.get('slug') ?? '';
      const selected = this.productService.getProduct(slug);
      this.product = selected;
      this.selectedColor = selected?.colors[0] ?? '';
      this.selectedSize = selected?.sizes[0] ?? '';
      this.quantity = 1;
    });
  }

  incrementQuantity(): void {
    this.quantity += 1;
  }

  decrementQuantity(): void {
    this.quantity = Math.max(1, this.quantity - 1);
  }

  addToCart(): void {
    if (!this.product) {
      return;
    }

    this.cartService.addToCart(
      this.product.id,
      this.selectedColor,
      this.selectedSize,
      this.giftPackaging,
      this.quantity,
    );

    this.router.navigate(['/cart']);
  }
}
