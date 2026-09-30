import { Component, Input, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Spin360Directive } from '../directives/spin360.directive';
import { Product } from '../models/store';
import { PricingService } from '../services/pricing.service';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, Spin360Directive],
  template: `
    <article class="product-card" app360="tilt">
      <a
        [routerLink]="['/product', product.slug]"
        class="spin-slot"
        aria-label="{{ product.name }}"
      >
        <span class="circular-zoom">
          <span class="circular-zoom__orbit">
            <span class="circular-zoom__stage">
              <img class="circular-zoom__media" [src]="product.images[0]" [alt]="product.name" />
            </span>
          </span>
          <span class="circular-zoom__ring" aria-hidden="true"></span>
        </span>
      </a>
      <div class="product-meta">
        @if (product.badge) {
          <span class="badge">{{ product.badge }}</span>
        }
        <h3>{{ product.name }}</h3>
        <p>{{ product.description }}</p>
        <div class="price-row">
          <strong>{{ pricing.formatPrice(product.price) }}</strong>
          <span>{{
            product.compareAtPrice ? pricing.formatPrice(product.compareAtPrice) : ''
          }}</span>
        </div>
        <a [routerLink]="['/product', product.slug]" class="text-link">View product</a>
      </div>
    </article>
  `,
  styleUrl: './product-card.component.scss',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: Product;

  readonly pricing = inject(PricingService);
}
