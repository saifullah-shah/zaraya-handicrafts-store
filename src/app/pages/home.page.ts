import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProductCardComponent } from '../components/product-card.component';
import { PricingService } from '../services/pricing.service';
import { ProductService } from '../services/product.service';
import { ContentService } from '../services/content.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink, ProductCardComponent],
  template: `
    <section class="hero">
      <div class="container hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">{{ hero().eyebrow }}</p>
          <h1>{{ hero().title }}</h1>
          <p class="lead">{{ hero().subtitle }}</p>
          <div class="cta-group">
            @if (hero().buttonUrl) {
              <a class="button button-primary" [routerLink]="hero().buttonUrl">{{ hero().buttonLabel }}</a>
            }
            <a class="button button-secondary" routerLink="/about">Our story</a>
          </div>
          <ul class="trust-row" aria-label="Brand trust metrics">
            @for (point of heroPoints(); track point) {
              <li>{{ point }}</li>
            }
          </ul>
        </div>

        <div class="hero-visual" aria-label="Featured handmade bracelet product image">
          <img [src]="hero().imageUrl" alt="Gold bracelet displayed on a neutral background" />
          <div class="floating-card">
            <div class="mini-label">Featured</div>
            <strong>Zaraya Gold Arc</strong>
            <span>{{ pricing.formatPrice(products()[0]?.price ?? 0) }}</span>
          </div>
        </div>
      </div>
    </section>

    <section class="showcase section-spacing">
      <div class="container">
        <div class="section-heading">
          <p class="eyebrow">{{ collectionHeading().eyebrow }}</p>
          <h2>{{ collectionHeading().title }}</h2>
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

    <section class="benefits section-spacing">
      <div class="container">
        <div class="section-heading narrow">
          <p class="eyebrow">{{ benefitsHeading().eyebrow }}</p>
          <h2>{{ benefitsHeading().title }}</h2>
        </div>

        <div class="benefit-grid">
          @for (benefit of benefits(); track benefit.id) {
            <div class="benefit-item">
              <span>{{ benefit.eyebrow }}</span>
              <h3>{{ benefit.title }}</h3>
              <p>{{ benefit.subtitle }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <section class="story section-spacing">
      <div class="container story-inner">
        <div class="story-media">
          <img [src]="story().imageUrl" alt="Lifestyle shot of handcrafted jewelry" />
        </div>
        <div class="story-copy">
          <p class="eyebrow">{{ story().eyebrow }}</p>
          <h2>{{ story().title }}</h2>
          @if (story().subtitle) {
            <p>{{ story().subtitle }}</p>
          }
          @if (story().body) {
            <p>{{ story().body }}</p>
          }
        </div>
      </div>
    </section>

    <section class="reviews section-spacing">
      <div class="container">
        <div class="section-heading narrow">
          <p class="eyebrow">{{ reviewsHeading().eyebrow }}</p>
          <h2>{{ reviewsHeading().title }}</h2>
        </div>

        <div class="review-grid">
          @for (review of reviews(); track review.id) {
            <article class="review-card">
              <div class="stars">{{ review.eyebrow || '★★★★★' }}</div>
              <p>“{{ review.subtitle }}”</p>
              <strong>— {{ review.title }}</strong>
            </article>
          }
        </div>
      </div>
    </section>

    <section class="faq section-spacing">
      <div class="container faq-inner">
        <div class="section-heading narrow left">
          <p class="eyebrow">{{ faqHeading().eyebrow }}</p>
          <h2>{{ faqHeading().title }}</h2>
        </div>

        <div class="faq-list">
          @for (item of faq(); track item.id) {
            <div class="faq-item">
              <h3>{{ item.title }}</h3>
              <p>{{ item.subtitle }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <section class="cta-band section-spacing">
      <div class="container cta-inner">
        <div>
          <p class="eyebrow">Ready to wear it</p>
          <h2>Make your everyday ritual feel special.</h2>
        </div>
        <a class="button button-primary" routerLink="/products">Shop now</a>
      </div>
    </section>
  `,
  styleUrl: './home.page.scss',
})
export class HomePage {
  readonly productService = inject(ProductService);
  readonly pricing = inject(PricingService);
  private readonly content = inject(ContentService);

  readonly products = computed(() => this.productService.getProducts());
  readonly hero = computed(() => this.content.one('hero'));
  readonly heroPoints = computed(() =>
    this.hero()
      .body.split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  );
  readonly collectionHeading = computed(() => this.content.one('collection-heading'));
  readonly benefitsHeading = computed(() => this.content.one('benefits-heading'));
  readonly benefits = computed(() => this.content.many('benefit'));
  readonly story = computed(() => this.content.one('story'));
  readonly reviewsHeading = computed(() => this.content.one('reviews-heading'));
  readonly reviews = computed(() => this.content.many('review'));
  readonly faqHeading = computed(() => this.content.one('faq-heading'));
  readonly faq = computed(() => this.content.many('faq'));
}
