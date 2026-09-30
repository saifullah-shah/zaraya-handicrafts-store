import { createClient } from 'npm:@supabase/supabase-js@2';

const siteUrl = (Deno.env.get('SITE_URL') || 'http://localhost:4200').replace(/\/+$/, '');

function stripeSiteUrl(): string {
  const configured = Deno.env.get('SITE_URL')?.trim() ?? '';
  if (!configured || configured.includes('YOUR_') || configured.includes('example.com')) {
    throw new RequestError(503, 'Card payments are not configured yet. Please choose cash on delivery.');
  }
  let parsed: URL;
  try {
    parsed = new URL(configured);
  } catch {
    throw new RequestError(503, 'Card payments are not configured yet. Please choose cash on delivery.');
  }
  if (parsed.protocol !== 'https:' && !parsed.hostname.startsWith('localhost')) {
    throw new RequestError(503, 'Card payments require a secure SITE_URL. Please choose cash on delivery.');
  }
  return configured.replace(/\/+$/, '');
}

const corsHeaders = {
  'Access-Control-Allow-Origin': siteUrl,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, idempotency-key',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
};
const currency = 'usd';

class RequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface OrderItemInput {
  productId: string;
  quantity: number;
  color?: string;
  size?: string;
  giftPackaging?: boolean;
}

interface AddressInput {
  fullName: string;
  email: string;
  phone?: string;
  street: string;
  city: string;
  state?: string;
  postalCode?: string;
  country: string;
  note?: string;
  billingAddress?: Record<string, unknown>;
}

interface OrderResult {
  orderId: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  stripeCheckoutUrl?: string | null;
  subtotalCents: number;
  giftPackagingCents: number;
  shippingCents: number;
  taxCents: number;
  discountCents: number;
  totalCents: number;
  currency: string;
  giftPackagingUnitCents?: number;
}

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  payment_method: string;
  stripe_session_id: string | null;
  stripe_checkout_url: string | null;
  confirmation_token_hash: string | null;
  subtotal_cents: number;
  gift_packaging_cents: number;
  gift_packaging_unit_cents: number | null;
  shipping_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
}

interface OrderItemRow {
  product_name: string;
  quantity: number;
  unit_price_cents: number;
  gift_packaging: boolean;
  color: string | null;
  size: string | null;
  product_image_url: string | null;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function originAllowed(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return false;
  if (origin === siteUrl) return true;
  return siteUrl.includes('localhost') && /^http:\/\/localhost:\d+$/.test(origin);
}

function clientAddress(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for') ?? '';
  const first = forwarded.split(',')[0]?.trim() ?? '';
  return first || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeAddress(value: unknown): AddressInput {
  if (!value || typeof value !== 'object') {
    throw new RequestError(400, 'A shipping address is required.');
  }
  const address = value as Record<string, unknown>;
  const normalized: AddressInput = {
    fullName: text(address['fullName'], 120),
    email: text(address['email'], 254).toLowerCase(),
    phone: text(address['phone'], 40),
    street: text(address['street'], 240),
    city: text(address['city'], 100),
    state: text(address['state'], 100),
    postalCode: text(address['postalCode'], 24),
    country: text(address['country'], 100),
    note: text(address['note'], 1000),
  };
  if (
    !normalized.fullName ||
    !normalized.email ||
    !normalized.street ||
    !normalized.city ||
    !normalized.country
  ) {
    throw new RequestError(400, 'Complete all required shipping fields.');
  }
  if (address['billingAddress'] && typeof address['billingAddress'] === 'object') {
    normalized.billingAddress = address['billingAddress'] as Record<string, unknown>;
  }
  return normalized;
}

function normalizeItems(value: unknown): OrderItemInput[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) {
    throw new RequestError(400, 'The order must contain between 1 and 50 items.');
  }
  return value.map((item) => {
    if (!item || typeof item !== 'object') {
      throw new RequestError(400, 'An order item is invalid.');
    }
    const row = item as Record<string, unknown>;
    const productId = text(row['productId'], 120);
    const quantity = Number(row['quantity']);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw new RequestError(400, 'An order item has an invalid product or quantity.');
    }
    if (typeof row['giftPackaging'] !== 'boolean') {
      throw new RequestError(400, 'Gift packaging must be specified for every item.');
    }
    return {
      productId,
      quantity,
      color: text(row['color'], 80),
      size: text(row['size'], 80),
      giftPackaging: row['giftPackaging'],
    };
  });
}

function idempotencyKey(req: Request, body: Record<string, unknown>): string {
  const supplied = text(req.headers.get('Idempotency-Key') ?? body['idempotencyKey'], 200);
  if (supplied) {
    return supplied;
  }
  return crypto.randomUUID();
}

async function getUserId(supabase: ReturnType<typeof createClient>, req: Request): Promise<string | null> {
  const header = req.headers.get('authorization');
  if (!header) {
    return null;
  }
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    throw new RequestError(401, 'Your session has expired.');
  }
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    throw new RequestError(401, 'Your session has expired.');
  }
  return data.user.id;
}

async function releaseOrder(
  supabase: ReturnType<typeof createClient>,
  orderId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc('release_order_stock', {
    p_order_id: orderId,
    p_reason: reason,
  });
  if (error) {
    console.error('Could not release order stock:', error.message);
  }
}

function stripeErrorMessage(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return 'Stripe could not create a checkout session.';
  }
  const value = body as { error?: { message?: string } };
  return value.error?.message ?? 'Stripe could not create a checkout session.';
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function confirmationTokenFor(orderId: string, key: string): Promise<string> {
  const secret = Deno.env.get('ORDER_CONFIRMATION_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!secret) {
    throw new RequestError(503, 'Order confirmation is temporarily unavailable. Please try again.');
  }
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, encoder.encode(`${orderId}:${key}`));
  const hex = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${hex.slice(0, 32)}-${hex.slice(32, 64)}`;
}

Deno.serve(async (req) => {
  if (!originAllowed(req)) {
    return json({ error: 'Origin is not allowed.' }, 403);
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  let supabase: ReturnType<typeof createClient>;
  try {
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    const body = (await req.json()) as Record<string, unknown>;
    const items = normalizeItems(body['items']);
    const address = normalizeAddress(body['address']);
    const paymentMethod = text(body['paymentMethod'], 20);
    if (paymentMethod !== 'stripe' && paymentMethod !== 'cod') {
      throw new RequestError(400, 'Unsupported payment method.');
    }
    const key = idempotencyKey(req, body);
    const userId = await getUserId(supabase, req);

    const redirectBase = paymentMethod === 'stripe' ? stripeSiteUrl() : siteUrl;

    const ipKey = `ip:${await sha256Hex(clientAddress(req))}`;
    const emailKey = `email:${await sha256Hex(address.email.toLowerCase())}`;
    const [ipLimit, emailLimit] = await Promise.all([
      supabase.rpc('check_checkout_rate_limit', { p_key: ipKey, p_limit: 8, p_window: '00:10:00' }),
      supabase.rpc('check_checkout_rate_limit', { p_key: emailKey, p_limit: 4, p_window: '00:10:00' }),
    ]);
    if (ipLimit.error || emailLimit.error || ipLimit.data !== true || emailLimit.data !== true) {
      throw new RequestError(429, 'Too many checkout attempts. Please wait a few minutes and try again.');
    }

    const { data, error } = await supabase.rpc('create_order_atomic', {
      p_items: items,
      p_address: address,
      p_payment_method: paymentMethod,
      p_user_id: userId,
      p_idempotency_key: key,
    });
    if (error) {
      if (error.message.includes('INSUFFICIENT_STOCK')) {
        throw new RequestError(409, 'One or more items are no longer available in the requested quantity.');
      }
      if (error.message.includes('COD_LIMIT_REACHED')) {
        throw new RequestError(429, 'You already have a cash on delivery order awaiting confirmation. Please contact us if you need to change it.');
      }
      if (
        error.message.includes('INVALID_') ||
        error.message.includes('PRODUCT_NOT_FOUND') ||
        error.message.includes('EMPTY_ORDER') ||
        error.message.includes('UNSUPPORTED_PAYMENT_METHOD')
      ) {
        throw new RequestError(400, 'The order details are invalid. Please refresh and try again.');
      }
      console.error('Order creation failed:', error.message);
      throw new RequestError(500, 'We could not create your order. Please try again.');
    }

    const created = data as OrderResult;
    if (!created?.orderId || !created.orderNumber) {
      throw new RequestError(500, 'The order response was incomplete. Please try again.');
    }
    if (created.paymentMethod && created.paymentMethod !== paymentMethod) {
      throw new RequestError(409, 'This checkout attempt has already been used.');
    }

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status, payment_method, stripe_session_id, stripe_checkout_url, confirmation_token_hash, subtotal_cents, gift_packaging_cents, gift_packaging_unit_cents, shipping_cents, tax_cents, discount_cents, total_cents, currency')
      .eq('id', created.orderId)
      .single();
    if (orderError || !orderData) {
      throw new RequestError(500, 'The order could not be loaded.');
    }
    const order = orderData as OrderRow;
    if (order.payment_method !== paymentMethod) {
      throw new RequestError(409, 'This checkout attempt has already been used.');
    }
    const { data: replayItems, error: replayItemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity, color, size, gift_packaging')
      .eq('order_id', order.id);
    if (replayItemsError) {
      throw new RequestError(500, 'The order could not be verified. Please try again.');
    }
    const requested = new Map<string, string>();
    for (const item of items) {
      requested.set(item.productId, JSON.stringify([item.quantity, item.color ?? '', item.size ?? '', item.giftPackaging === true]));
    }
    const stored = new Map<string, string>();
    for (const row of (replayItems ?? []) as Array<{ product_id: string; quantity: number; color: string | null; size: string | null; gift_packaging: boolean }>) {
      stored.set(String(row.product_id), JSON.stringify([Number(row.quantity), row.color ?? '', row.size ?? '', row.gift_packaging === true]));
    }
    const replayMatches =
      stored.size === requested.size &&
      [...requested.entries()].every(([productId, signature]) => stored.get(productId) === signature);
    if (!replayMatches) {
      throw new RequestError(409, 'This checkout attempt was already used with different order details. Please start a new checkout.');
    }
    const confirmationToken = await confirmationTokenFor(order.id, key);
    const tokenHash = await sha256Hex(confirmationToken);
    if (!order.confirmation_token_hash) {
      const { data: tokenRows, error: tokenError } = await supabase
        .from('orders')
        .update({ confirmation_token_hash: tokenHash })
        .eq('id', order.id)
        .is('confirmation_token_hash', null)
        .select('confirmation_token_hash');
      if (tokenError) {
        await releaseOrder(supabase, order.id, 'confirmation_token_persistence_failed');
        throw new RequestError(500, 'The order confirmation could not be prepared. Please try again.');
      }
      const persisted = Array.isArray(tokenRows) ? tokenRows[0]?.confirmation_token_hash : null;
      if (persisted && persisted !== tokenHash) {
        throw new RequestError(500, 'The order confirmation could not be prepared. Please contact support.');
      }
      order.confirmation_token_hash = tokenHash;
    } else if (order.confirmation_token_hash !== tokenHash) {
      throw new RequestError(409, 'This checkout attempt was already completed. Please use your original confirmation link.');
    }
    const confirmation = { confirmationToken };
    if (paymentMethod === 'cod') {
      return json({
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        ...confirmation,
        subtotalCents: order.subtotal_cents,
        giftPackagingCents: order.gift_packaging_cents,
        shippingCents: order.shipping_cents,
        taxCents: order.tax_cents,
        discountCents: order.discount_cents,
        totalCents: order.total_cents,
        currency: order.currency,
      });
    }

    if (order.stripe_checkout_url && order.status === 'pending') {
      return json({
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        ...confirmation,
        sessionUrl: order.stripe_checkout_url,
        subtotalCents: order.subtotal_cents,
        giftPackagingCents: order.gift_packaging_cents,
        shippingCents: order.shipping_cents,
        taxCents: order.tax_cents,
        discountCents: order.discount_cents,
        totalCents: order.total_cents,
        currency: order.currency,
      });
    }
    if (order.status !== 'pending') {
      return json({
        orderId: order.id,
        orderNumber: order.order_number,
        status: order.status,
        ...confirmation,
        subtotalCents: order.subtotal_cents,
        giftPackagingCents: order.gift_packaging_cents,
        shippingCents: order.shipping_cents,
        taxCents: order.tax_cents,
        discountCents: order.discount_cents,
        totalCents: order.total_cents,
        currency: order.currency,
      });
    }

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
    if (!stripeSecret) {
      await releaseOrder(supabase, order.id, 'stripe_not_configured');
      throw new RequestError(503, 'Card payments are temporarily unavailable. Please choose cash on delivery or try again later.');
    }

    const { data: itemData, error: itemError } = await supabase
      .from('order_items')
      .select('product_name, quantity, unit_price_cents, gift_packaging, color, size, product_image_url')
      .eq('order_id', order.id);
    if (itemError || !itemData?.length) {
      await releaseOrder(supabase, order.id, 'order_items_unavailable');
      throw new RequestError(500, 'The order items could not be loaded.');
    }

    const orderItems = itemData as OrderItemRow[];
    const giftUnit = Number(order.gift_packaging_unit_cents ?? 0);
    const calculatedSubtotal = orderItems.reduce(
      (total, item) => total + Number(item.unit_price_cents) * Number(item.quantity),
      0,
    );
    const calculatedGift = orderItems.reduce(
      (total, item) => total + (item.gift_packaging ? giftUnit * Number(item.quantity) : 0),
      0,
    );
    if (
      calculatedSubtotal !== Number(order.subtotal_cents) ||
      calculatedGift !== Number(order.gift_packaging_cents) ||
      calculatedSubtotal + calculatedGift + Number(order.shipping_cents) + Number(order.tax_cents) - Number(order.discount_cents) !== Number(order.total_cents)
    ) {
      await releaseOrder(supabase, order.id, 'order_total_mismatch');
      throw new RequestError(500, 'The order total could not be verified. Please try again.');
    }

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('currency', order.currency || currency);
    form.set('client_reference_id', order.id);
    form.set('metadata[orderId]', order.id);
    form.set('metadata[orderNumber]', order.order_number);
    form.set('metadata[idempotencyKey]', key);
    form.set('customer_email', address.email);
    form.set('billing_address_collection', 'auto');
    form.set('phone_number_collection[enabled]', 'true');
    form.set('success_url', `${redirectBase}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`);
    form.set('cancel_url', `${redirectBase}/checkout?cancelled=1`);
    form.set('payment_intent_data[metadata][orderId]', order.id);

    let lineIndex = 0;
    for (const item of orderItems) {
      const description = [item.color, item.size].filter(Boolean).join(' · ');
      form.set(`line_items[${lineIndex}][quantity]`, String(item.quantity));
      form.set(`line_items[${lineIndex}][price_data][currency]`, order.currency || currency);
      form.set(`line_items[${lineIndex}][price_data][unit_amount]`, String(item.unit_price_cents));
      form.set(`line_items[${lineIndex}][price_data][product_data][name]`, item.product_name.slice(0, 200));
      if (description) {
        form.set(`line_items[${lineIndex}][price_data][product_data][description]`, description.slice(0, 500));
      }
      if (item.product_image_url?.startsWith('https://')) {
        form.set(`line_items[${lineIndex}][price_data][product_data][images][0]`, item.product_image_url);
      }
      lineIndex += 1;
      if (item.gift_packaging) {
        form.set(`line_items[${lineIndex}][quantity]`, String(item.quantity));
        form.set(`line_items[${lineIndex}][price_data][currency]`, order.currency || currency);
        form.set(`line_items[${lineIndex}][price_data][unit_amount]`, String(giftUnit));
        form.set(`line_items[${lineIndex}][price_data][product_data][name]`, 'Gift packaging');
        lineIndex += 1;
      }
    }
    if (Number(order.shipping_cents) > 0) {
      form.set('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
      form.set('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(order.shipping_cents));
      form.set('shipping_options[0][shipping_rate_data][fixed_amount][currency]', order.currency || currency);
      form.set('shipping_options[0][shipping_rate_data][display_name]', 'Standard shipping');
    }

    const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': key,
      },
      body: form.toString(),
    });
    const stripeBody = (await stripeResponse.json().catch(() => null)) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    } | null;
    if (!stripeResponse.ok || !stripeBody?.id || !stripeBody.url) {
      await releaseOrder(supabase, order.id, 'stripe_session_creation_failed');
      throw new RequestError(502, stripeErrorMessage(stripeBody));
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ stripe_session_id: stripeBody.id, stripe_checkout_url: stripeBody.url })
      .eq('id', order.id);
    if (updateError) {
      await fetch(`https://api.stripe.com/v1/checkout/sessions/${stripeBody.id}/expire`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${stripeSecret}` },
      }).catch(() => undefined);
      await releaseOrder(supabase, order.id, 'stripe_session_persistence_failed');
      throw new RequestError(500, 'The payment session could not be saved. Please try again.');
    }

    return json({
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      ...confirmation,
      sessionUrl: stripeBody.url,
      subtotalCents: order.subtotal_cents,
      giftPackagingCents: order.gift_packaging_cents,
      shippingCents: order.shipping_cents,
      taxCents: order.tax_cents,
      discountCents: order.discount_cents,
      totalCents: order.total_cents,
      currency: order.currency,
    });
  } catch (error) {
    if (error instanceof RequestError) {
      return json({ error: error.message }, error.status);
    }
    console.error('Unhandled create-order error:', error instanceof Error ? error.message : error);
    return json({ error: 'We could not create your order. Please try again.' }, 500);
  }
});
