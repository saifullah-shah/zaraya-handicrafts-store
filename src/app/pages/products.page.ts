import { Component, computed, inject } from '@angular/core';
import { ProductCardComponent } from '../components/product-card.component';
import { ProductService } from '../services/product.service';
import { StoreSettingsService } from '../services/store-settings.service';

@Component({
  selector: 'app-products-page',
  standalone: true,
  imports: [ProductCardComponent],
  template: `
    <section class="collection section-spacing">
      <div class="container">
        <div class="section-heading">
          <p class="eyebrow">The collection</p>
          <h1>{{ heading() }}</h1>
        </div>

        @if (productService.catalogError()) {
          <p class="error-text">{{ productService.catalogError() }}</p>
        }

        <div class="product-grid">
          @for (product of products(); track product.id) {
            <app-product-card [product]="product" />
          } @empty {
            <p class="error-text">No products are available right now. Please check back soon.</p>
          }
        </div>
      </div>
    </section>
  `,
  styleUrl: './products.page.scss',
})
export class ProductsPage {
  readonly productService = inject(ProductService);
  private readonly settings = inject(StoreSettingsService);

  readonly products = computed(() => this.productService.getProducts());

  readonly heading = computed(() => {
    const name = this.settings.siteName().trim();
    return name ? `${name} collection` : 'Our collection';
  });
}
