import { Injectable, inject, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface HomeSection {
  id: string;
  key: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  imageUrl: string;
  sort: number;
}

const DEFAULTS: HomeSection[] = [
  {
    id: 'home.hero',
    key: 'hero',
    eyebrow: 'Handmade in small batches',
    title: 'Jewelry designed to feel personal, slow, and beautifully yours.',
    subtitle:
      'Zaraya Handicrafts reimagines everyday elegance with handcrafted bracelets made to be gifted, layered, and treasured.',
    body: '4.9/5 reviews\nWorldwide shipping\nGift-ready packaging',
    buttonLabel: 'Shop the bracelet',
    buttonUrl: '/product/zaraya-gold-arc-bracelet',
    imageUrl:
      'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=80',
    sort: 10,
  },
  {
    id: 'home.announcement',
    key: 'announcement',
    eyebrow: '',
    title: 'Free shipping on orders over $200',
    subtitle: '',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 5,
  },
  {
    id: 'home.collection.heading',
    key: 'collection-heading',
    eyebrow: 'The collection',
    title: 'Fine details, lasting presence.',
    subtitle: '',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 20,
  },
  {
    id: 'home.benefits.heading',
    key: 'benefits-heading',
    eyebrow: 'Why Zaraya',
    title: 'Crafted for meaningful everyday moments.',
    subtitle: '',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 30,
  },
  {
    id: 'home.benefit.1',
    key: 'benefit',
    eyebrow: '01',
    title: 'Hand-finished',
    subtitle: 'Small-batch craftsmanship with an artisan finish and intentional details.',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 31,
  },
  {
    id: 'home.benefit.2',
    key: 'benefit',
    eyebrow: '02',
    title: 'Gift-ready',
    subtitle:
      'Every order ships in premium packaging designed to feel special from the moment it arrives.',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 32,
  },
  {
    id: 'home.benefit.3',
    key: 'benefit',
    eyebrow: '03',
    title: 'Made to last',
    subtitle: 'Thoughtful materials, sturdy finishing, and timeless silhouettes built for everyday wear.',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 33,
  },
  {
    id: 'home.story',
    key: 'story',
    eyebrow: 'Our story',
    title: 'Luxury, but personal.',
    subtitle:
      'We create bracelets that balance modern elegance with the warmth of handmade craft. Each design is rooted in the idea that small, meaningful details become the pieces we reach for every day.',
    body: 'From gifting to everyday wear, Zaraya celebrates rituals that feel thoughtful, intimate, and enduring.',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl:
      'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1200&q=80',
    sort: 40,
  },
  {
    id: 'home.reviews.heading',
    key: 'reviews-heading',
    eyebrow: 'Loved by customers',
    title: 'Quiet confidence, real joy.',
    subtitle: '',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 50,
  },
  {
    id: 'home.review.1',
    key: 'review',
    eyebrow: '★★★★★',
    title: 'Ayesha M.',
    subtitle:
      'The packaging was beautiful, and the bracelet feels incredibly premium. It looks even better in person.',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 51,
  },
  {
    id: 'home.review.2',
    key: 'review',
    eyebrow: '★★★★★',
    title: 'Hamza S.',
    subtitle:
      'A perfect gift. The quality is exceptional and the finish feels refined without being overdone.',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 52,
  },
  {
    id: 'home.review.3',
    key: 'review',
    eyebrow: '★★★★★',
    title: 'Sara K.',
    subtitle:
      'Elegant, minimal, and exactly what I was looking for. I’ve received compliments every time I wear it.',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 53,
  },
  {
    id: 'home.faq.heading',
    key: 'faq-heading',
    eyebrow: 'FAQ',
    title: 'Questions, answered simply.',
    subtitle: '',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 60,
  },
  {
    id: 'home.faq.1',
    key: 'faq',
    eyebrow: '',
    title: 'Do you ship worldwide?',
    subtitle: 'Yes. We ship internationally with tracked delivery and transparent shipping timelines.',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 61,
  },
  {
    id: 'home.faq.2',
    key: 'faq',
    eyebrow: '',
    title: 'Is the bracelet adjustable?',
    subtitle:
      'Each bracelet is designed with a comfortable fit and available in multiple sizes for a tailored feel.',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 62,
  },
  {
    id: 'home.faq.3',
    key: 'faq',
    eyebrow: '',
    title: 'Do you offer gift packaging?',
    subtitle: 'Yes, every order can be presented in premium gift-ready packaging at checkout.',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 63,
  },
];

@Injectable({ providedIn: 'root' })
export class ContentService {
  private readonly supabase = inject(SupabaseService);
  readonly sections = signal<HomeSection[]>(DEFAULTS);

  async ready(): Promise<void> {
    if (!this.supabase.configured) {
      return;
    }
    const { data, error } = await this.supabase.supabase
      .from('content_sections')
      .select('id, key, eyebrow, title, subtitle, body, button_label, button_url, image_url, sort')
      .eq('page', 'home')
      .eq('is_visible', true)
      .order('sort');
    if (error || !data?.length) {
      return;
    }
    const rows = (data as Array<Record<string, unknown>>).map((row) => ({
      id: String(row['id'] ?? ''),
      key: String(row['key'] ?? ''),
      eyebrow: String(row['eyebrow'] ?? ''),
      title: String(row['title'] ?? ''),
      subtitle: String(row['subtitle'] ?? ''),
      body: String(row['body'] ?? ''),
      buttonLabel: String(row['button_label'] ?? ''),
      buttonUrl: String(row['button_url'] ?? ''),
      imageUrl: String(row['image_url'] ?? ''),
      sort: Number(row['sort'] ?? 0),
    }));
    const merged = new Map<string, HomeSection>();
    for (const section of DEFAULTS) merged.set(section.id, section);
    for (const section of rows) merged.set(section.id, section);
    this.sections.set([...merged.values()].sort((a, b) => a.sort - b.sort));
  }

  one(key: string, fallback: HomeSection | null = null): HomeSection {
    return this.sections().find((section) => section.key === key) ?? fallback ?? blankSection(key);
  }

  many(key: string): HomeSection[] {
    return this.sections().filter((section) => section.key === key);
  }
}

function blankSection(key: string): HomeSection {
  return {
    id: '',
    key,
    eyebrow: '',
    title: '',
    subtitle: '',
    body: '',
    buttonLabel: '',
    buttonUrl: '',
    imageUrl: '',
    sort: 0,
  };
}
