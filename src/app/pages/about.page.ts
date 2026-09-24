import { Component } from '@angular/core';

@Component({
  selector: 'app-about-page',
  standalone: true,
  template: `
    <section class="container about-page">
      <p class="eyebrow">About Zaraya</p>
      <h1>Artisan jewelry that feels deeply personal.</h1>
      <div class="about-grid">
        <div>
          <p>
            Zaraya Handicrafts brings together handcrafted detail, soulful design, and the kind of modern luxury
            that belongs in everyday rituals.
          </p>
          <p>
            Every piece is created with intention: minimal silhouettes, premium finishes, and the gentle confidence
            of something made to be kept and gifted.
          </p>
        </div>
        <div>
          <img
            src="https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=80"
            alt="Close-up of handcrafted bracelet design"
          />
        </div>
      </div>
    </section>
  `,
  styleUrl: './about.page.scss',
})
export class AboutPage {}
