import { createClient } from 'npm:@supabase/supabase-js@2';

const siteUrl = (Deno.env.get('SITE_URL') || 'http://localhost:4200').replace(/\/+$/, '');
const corsHeaders = {
  'Access-Control-Allow-Origin': siteUrl,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Vary': 'Origin',
};

interface OrderRow {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal_cents: number;
  gift_packaging_cents: number;
  shipping_cents: number;
  tax_cents: number;
  discount_cents: number;
  total_cents: number;
  currency: string;
  created_at: string;
}

interface OrderItemRow {
  product_name: string;
  quantity: number;
  color: string | null;
  size: string | null;
  gift_packaging: boolean;
  unit_price_cents: number;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function allowedOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;
  if (origin === siteUrl) return true;
  return siteUrl.includes('localhost') && /^http:\/\/localhost:\d+$/.test(origin);
}

async function tokenHash(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (!allowedOrigin(req)) {
    return json({ error: 'Origin is not allowed.' }, 403);
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  try {
    const url = new URL(req.url);
    const sessionId = url.searchParams.get('session_id')?.trim() ?? '';
    const orderId = url.searchParams.get('order_id')?.trim() ?? '';
    const confirmationToken = url.searchParams.get('confirmation_token')?.trim() ?? '';
    const hasSession = /^cs_[A-Za-z0-9_]{8,}$/.test(sessionId);
    const hasToken =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(orderId) &&
      /^[A-Za-z0-9-]{20,200}$/.test(confirmationToken);
    if (!hasSession && !hasToken) {
      return json({ error: 'A valid order confirmation is required.' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    let query = supabase
      .from('orders')
      .select('id, order_number, status, payment_status, payment_method, subtotal_cents, gift_packaging_cents, shipping_cents, tax_cents, discount_cents, total_cents, currency, created_at');
    if (hasSession) {
      query = query.eq('stripe_session_id', sessionId);
    } else {
      query = query.eq('id', orderId).eq('confirmation_token_hash', await tokenHash(confirmationToken));
    }
    const { data: orderData, error: orderError } = await query.single();
    if (orderError || !orderData) {
      return json({ error: 'Order confirmation was not found.' }, 404);
    }
    const order = orderData as OrderRow;

    if (hasSession) {
      const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
      if (!stripeSecret) {
        return json({ error: 'Order confirmation is temporarily unavailable.' }, 503);
      }
      const stripeResponse = await fetch(
        `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
        { headers: { Authorization: `Bearer ${stripeSecret}` } },
      ).catch(() => null);
      if (!stripeResponse?.ok) {
        return json({ error: 'Order confirmation is temporarily unavailable.' }, 503);
      }
      const session = (await stripeResponse.json().catch(() => null)) as { client_reference_id?: string } | null;
      if (session?.client_reference_id !== order.id) {
        return json({ error: 'Order confirmation was not found.' }, 404);
      }
    }

    const { data: itemData, error: itemError } = await supabase
      .from('order_items')
      .select('product_name, quantity, color, size, gift_packaging, unit_price_cents')
      .eq('order_id', order.id)
      .order('id');
    if (itemError) {
      return json({ error: 'Order confirmation is temporarily unavailable.' }, 503);
    }
    return json({
      orderId: order.id,
      orderNumber: order.order_number,
      status: order.status,
      paymentStatus: order.payment_status,
      paymentMethod: order.payment_method,
      subtotalCents: order.subtotal_cents,
      giftPackagingCents: order.gift_packaging_cents,
      shippingCents: order.shipping_cents,
      taxCents: order.tax_cents,
      discountCents: order.discount_cents,
      totalCents: order.total_cents,
      currency: order.currency,
      createdAt: order.created_at,
      items: ((itemData ?? []) as OrderItemRow[]).map((item) => ({
        productName: item.product_name,
        quantity: item.quantity,
        color: item.color ?? '',
        size: item.size ?? '',
        giftPackaging: item.gift_packaging,
        unitPriceCents: item.unit_price_cents,
      })),
    });
  } catch (error) {
    console.error('Order status lookup failed:', error instanceof Error ? error.message : error);
    return json({ error: 'Order confirmation is temporarily unavailable.' }, 500);
  }
});
