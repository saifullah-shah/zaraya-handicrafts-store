export interface ContentSection {
  id: string;
  page: string;
  key: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  imageUrl: string;
  sort: number;
  isVisible: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdminContentSectionRow {
  id: string;
  page: string;
  key: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  body: string;
  button_label: string;
  button_url: string;
  image_url: string;
  sort: number;
  is_visible: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface StoreSettings {
  siteName: string;
  currency: string;
  announcement: string;
  shippingFee: number;
  freeShippingThreshold: number;
  giftPackagingFee: number;
  supportEmail: string;
  supportPhone: string;
  [key: string]: string | number;
}

export interface AdminOrder {
  id: string;
  orderNumber: string;
  email: string;
  status: string;
  paymentMethod: string;
  currency: string;
  subtotalCents: number;
  giftPackagingCents: number;
  shippingCents: number;
  totalCents: number;
  shippingAddress: Record<string, string>;
  stripeSessionId: string;
  createdAt: string;
  items: AdminOrderItem[];
}

export interface AdminOrderItem {
  id: string;
  productName: string;
  quantity: number;
  color: string;
  size: string;
  giftPackaging: boolean;
  unitPriceCents: number;
}

export interface AdminOrderRow {
  id: string;
  order_number: string;
  email: string;
  status: string;
  payment_method: string;
  currency: string;
  subtotal_cents: number;
  gift_packaging_cents: number;
  shipping_cents: number;
  total_cents: number;
  shipping_address: Record<string, string>;
  stripe_session_id: string | null;
  created_at: string;
}

export interface AdminOrderItemRow {
  id: string;
  order_id: string;
  product_name: string;
  quantity: number;
  color: string;
  size: string;
  gift_packaging: boolean;
  unit_price_cents: number;
}

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'cod_pending',
  'processing',
  'shipped',
  'delivered',
  'fulfilled',
  'cancelled',
  'payment_failed',
  'refunded',
  'partially_refunded',
  'returned',
] as const;

export const ORDER_STATUS_TRANSITIONS: Record<string, readonly string[]> = {
  pending: ['cancelled'],
  cod_pending: ['paid', 'processing', 'cancelled'],
  paid: ['processing', 'cancelled', 'refunded'],
  processing: ['fulfilled', 'shipped', 'cancelled', 'refunded'],
  fulfilled: ['shipped', 'delivered', 'cancelled', 'refunded'],
  shipped: ['delivered', 'returned', 'refunded'],
  delivered: ['returned', 'refunded'],
  returned: ['refunded'],
  refunded: ['returned'],
  cancelled: [],
  payment_failed: [],
  partially_refunded: [],
};

export function nextStatusesFor(status: string): readonly string[] {
  return ORDER_STATUS_TRANSITIONS[status] ?? [];
}

export function formatCents(cents: number | null | undefined, currency = 'usd'): string {
  const amount = (cents ?? 0) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: (currency || 'usd').toUpperCase(),
  }).format(amount);
}

export function formatDate(value: string | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}