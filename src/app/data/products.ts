import { Product } from '../models/store';

export const products: Product[] = [
  {
    id: 'zaraya-gold-arc',
    slug: 'zaraya-gold-arc-bracelet',
    name: 'Zaraya Gold Arc Bracelet',
    price: 148,
    compareAtPrice: 188,
    rating: 4.9,
    reviews: 236,
    badge: 'Best Seller',
    category: 'Handmade Jewelry',
    materials: ['18k gold vermeil', 'Brass core', 'Hand-finished polish'],
    description:
      'An heirloom-inspired bracelet designed for everyday rituals and elevated gifting.',
    longDescription:
      'The Gold Arc Bracelet is sculpted to feel light, refined, and unforgettable. Each piece is handmade in small quantities to preserve natural character and premium finish quality.',
    images: [
      'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1200&q=80',
    ],
    colors: ['Champagne Gold', 'Antique Silver', 'Rose Gold'],
    sizes: ['S', 'M', 'L'],
    stock: 24,
    giftPackaging: true,
    details: [
      'Handmade in limited batches',
      'Adjustable fit for everyday wear',
      'Comes gift-ready in a premium box',
      'Designed for layering or solo wear',
    ],
  },
  {
    id: 'zaraya-rose-veil',
    slug: 'zaraya-rose-veil-bracelet',
    name: 'Zaraya Rose Veil Bracelet',
    price: 162,
    compareAtPrice: 199,
    rating: 4.8,
    reviews: 184,
    badge: 'New Arrival',
    category: 'Fine Craft',
    materials: ['Rose gold finish', 'Brushed brass', 'Soft satin pouch'],
    description:
      'Soft curves and warm tones create a bracelet that feels as personal as it looks.',
    longDescription:
      'Crafted with a softly brushed finish and warm rose undertones, the Rose Veil Bracelet blends modern minimalism with artisanal charm for gifting and self-expression.',
    images: [
      'https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=80',
    ],
    colors: ['Rose Gold', 'Champagne Gold'],
    sizes: ['S', 'M', 'L'],
    stock: 18,
    giftPackaging: true,
    details: [
      'Warm rose tones with polished finish',
      'Designed for gifting and travel',
      'Brushed texture adds artisanal depth',
      'Includes protective packaging',
    ],
  },
  {
    id: 'zaraya-silkline',
    slug: 'zaraya-silkline-bracelet',
    name: 'Zaraya Silkline Bracelet',
    price: 136,
    compareAtPrice: 175,
    rating: 4.7,
    reviews: 152,
    badge: 'Signature',
    category: 'Minimal Luxe',
    materials: ['Sterling silver tone', 'Soft woven texture', 'Hand stitched detail'],
    description:
      'A muted, modern bracelet with soft texture and a polished, sculptural silhouette.',
    longDescription:
      'The Silkline Bracelet balances a refined silhouette with tactile craftsmanship. Its understated finish makes it ideal for layering or as a thoughtful everyday signature piece.',
    images: [
      'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80',
    ],
    colors: ['Silver', 'Ivory', 'Stone'],
    sizes: ['S', 'M', 'L'],
    stock: 31,
    giftPackaging: true,
    details: [
      'Minimal silhouette with subtle texture',
      'Weighted enough to feel premium',
      'Made for all-day wear',
      'Includes artisan care card',
    ],
  },
];
