import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Spin360Directive } from '../directives/spin360.directive';
import { PricingService } from '../services/pricing.service';
import { ProductService } from '../services/product.service';

@Component({
  selector: 'app-home-page',
  standalone: true,
  imports: [RouterLink, Spin360Directive],
  template: `
    <section class="hero">
      <div class="container hero-inner">
        <div class="hero-copy">
          <p class="eyebrow">Handmade in small batches</p>
          <h1>Jewelry designed to feel personal, slow, and beautifully yours.</h1>
          <p class="lead">
            Zaraya Handicrafts reimagines everyday elegance with handcrafted bracelets made to be
            gifted, layered, and treasured.
          </p>
          <div class="cta-group">
            <a class="button button-primary" routerLink="/product/zaraya-gold-arc-bracelet"
              >Shop the bracelet</a
            >
            <a class="button button-secondary" routerLink="/about">Our story</a>
          </div>
          <ul class="trust-row" aria-label="Brand trust metrics">
            <li>4.9/5 reviews</li>
            <li>Worldwide shipping</li>
            <li>Gift-ready packaging</li>
          </ul>
        </div>

        <div class="hero-visual" aria-label="Featured handmade bracelet product image">
          <img
            src="https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=80"
            alt="Gold bracelet displayed on a neutral background"
          />
          <div class="floating-card">
            <div class="mini-label">Featured</div>
            <strong>Zaraya Gold Arc</strong>
            <span>$148</span>
          </div>
        </div>
      </div>
    </section>

    <section class="showcase section-spacing">
      <div class="container">
        <div class="section-heading">
          <p class="eyebrow">The collection</p>
          <h2>Fine details, lasting presence.</h2>
        </div>

        <div class="product-grid">
          @for (product of featuredProducts(); track product.id) {
            <article class="product-card" app360="tilt">
              <a [routerLink]="['/product', product.slug]" class="spin-slot circular-zoom" aria-label="{{ product.name }}">
                <span class="circular-zoom__orbit">
                  <span class="circular-zoom__stage">
                    <img class="circular-zoom__media" [src]="product.images[0]" [alt]="product.name" />
                  </span>
                </span>
                <span class="circular-zoom__ring" aria-hidden="true"></span>
              </a>
              <div class="product-meta">
                <span class="badge">{{ product.badge }}</span>
                <h3>{{ product.name }}</h3>
                <p>{{ product.description }}</p>
                <div class="price-row">
                  <strong>{{ pricing.formatPrice(product.price) }}</strong>
                  <span>{{ product.compareAtPrice ? pricing.formatPrice(product.compareAtPrice) : '' }}</span>
                </div>
                <a [routerLink]="['/product', product.slug]" class="text-link">View product</a>
              </div>
            </article>
          }
        </div>
      </div>
    </section>

    <section class="benefits section-spacing">
      <div class="container">
        <div class="section-heading narrow">
          <p class="eyebrow">Why Zaraya</p>
          <h2>Crafted for meaningful everyday moments.</h2>
        </div>

        <div class="benefit-grid">
          <div class="benefit-item">
            <span>01</span>
            <h3>Hand-finished</h3>
            <p>Small-batch craftsmanship with an artisan finish and intentional details.</p>
          </div>
          <div class="benefit-item">
            <span>02</span>
            <h3>Gift-ready</h3>
            <p>
              Every order ships in premium packaging designed to feel special from the moment it
              arrives.
            </p>
          </div>
          <div class="benefit-item">
            <span>03</span>
            <h3>Made to last</h3>
            <p>
              Thoughtful materials, sturdy finishing, and timeless silhouettes built for everyday
              wear.
            </p>
          </div>
        </div>
      </div>
    </section>

    <section class="story section-spacing">
      <div class="container story-inner">
        <div class="story-media">
          <img
            src="https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1200&q=80"
            alt="Lifestyle shot of handcrafted jewelry"
          />
        </div>
        <div class="story-copy">
          <p class="eyebrow">Our story</p>
          <h2>Luxury, but personal.</h2>
          <p>
            We create bracelets that balance modern elegance with the warmth of handmade craft. Each
            design is rooted in the idea that small, meaningful details become the pieces we reach
            for every day.
          </p>
          <p>
            From gifting to everyday wear, Zaraya celebrates rituals that feel thoughtful, intimate,
            and enduring.
          </p>
        </div>
      </div>
    </section>

    <section class="reviews section-spacing">
      <div class="container">
        <div class="section-heading narrow">
          <p class="eyebrow">Loved by customers</p>
          <h2>Quiet confidence, real joy.</h2>
        </div>

        <div class="review-grid">
          <article class="review-card">
            <div class="stars">★★★★★</div>
            <p>
              “The packaging was beautiful, and the bracelet feels incredibly premium. It looks even
              better in person.”
            </p>
            <strong>— Ayesha M.</strong>
          </article>
          <article class="review-card">
            <div class="stars">★★★★★</div>
            <p>
              “A perfect gift. The quality is exceptional and the finish feels refined without being
              overdone.”
            </p>
            <strong>— Hamza S.</strong>
          </article>
          <article class="review-card">
            <div class="stars">★★★★★</div>
            <p>
              “Elegant, minimal, and exactly what I was looking for. I’ve received compliments every
              time I wear it.”
            </p>
            <strong>— Sara K.</strong>
          </article>
        </div>
      </div>
    </section>

    <section class="faq section-spacing">
      <div class="container faq-inner">
        <div class="section-heading narrow left">
          <p class="eyebrow">FAQ</p>
          <h2>Questions, answered simply.</h2>
        </div>

        <div class="faq-list">
          <div class="faq-item">
            <h3>Do you ship worldwide?</h3>
            <p>
              Yes. We ship internationally with tracked delivery and transparent shipping timelines.
            </p>
          </div>
          <div class="faq-item">
            <h3>Is the bracelet adjustable?</h3>
            <p>
              Each bracelet is designed with a comfortable fit and available in multiple sizes for a
              tailored feel.
            </p>
          </div>
          <div class="faq-item">
            <h3>Do you offer gift packaging?</h3>
            <p>Yes, every order can be presented in premium gift-ready packaging at checkout.</p>
          </div>
        </div>
      </div>
    </section>

    <section class="cta-band section-spacing">
      <div class="container cta-inner">
        <div>
          <p class="eyebrow">Ready to wear it</p>
          <h2>Make your everyday ritual feel special.</h2>
        </div>
        <a class="button button-primary" routerLink="/product/zaraya-gold-arc-bracelet">Shop now</a>
      </div>
    </section>
  `,
  styleUrl: './home.page.scss',
})
export class HomePage {
  private readonly productService = inject(ProductService);
  readonly pricing = inject(PricingService);

  readonly featuredProducts = computed(() => this.productService.getFeaturedProducts());
}
