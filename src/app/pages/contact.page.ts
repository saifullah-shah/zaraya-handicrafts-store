import { Component } from '@angular/core';

@Component({
  selector: 'app-contact-page',
  standalone: true,
  template: `
    <section class="container contact-page">
      <p class="eyebrow">Contact</p>
      <h1>We’d love to hear from you.</h1>

      <div class="contact-grid">
        <div class="contact-card">
          <h2>Email</h2>
          <p>hello@zarayahandicrafts.com</p>
        </div>
        <div class="contact-card">
          <h2>Phone</h2>
          <p>+92 300 1234567</p>
        </div>
        <div class="contact-card">
          <h2>Location</h2>
          <p>Karachi, Pakistan</p>
        </div>
      </div>
    </section>
  `,
  styleUrl: './contact.page.scss',
})
export class ContactPage {}
