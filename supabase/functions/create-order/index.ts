import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const GIFT_PACKAGING_CENTS = 1200;
const SHIPPING_CENTS = 1800;
const FREE_SHIPPING_CENTS_THRESHOLD = 200 * 100;
const CURRENCY = 'usd';

interface OrderItemInput {
  productId: string;
  quantity: number;
  color: string;
  size: string;
  giftPackaging: boolean;
  unitPrice: number;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const body = (await req.json()) as { items: OrderItemInput[]; address: Record<string, string>; paymentMethod: string };
    const items = body.items ?? [];
    const address = body.address ?? {};
    const paymentMethod = body.paymentMethod;

    if (!['stripe', 'cod'].includes(paymentMethod)) {
      return json({ error: 'Unsupported payment method.' }, 400);
    }
    if (items.length === 0) {
      return json({ error: 'The order has no items.' }, 400);
    }

    const productIds = [...new Set(items.map((item) => item.productId))];
    const { data: products, error: productError } = await supabase
      .from('products')
      .select('id, name, price')
      .in('id', productIds);

    if (productError) {
      throw new Error(productError.message);
    }
    const priceMap = new Map((products as { id: string; name: string; price: number }[]).map((product) => [product.id, product]));

    let subtotalCents = 0;
    let giftCents = 0;

    const orderItems = items.map((item) => {
      const product = priceMap.get(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} is no longer available.`);
      }
      if (Math.round(item.unitPrice * 100) !== Math.round(product.price * 100)) {
        throw new Error(`Price for ${product.name} has changed. Please refresh your cart.`);
      }
      const lineSubtotal = product.price * 100 * item.quantity;
      subtotalCents += lineSubtotal;
      if (item.giftPackaging) {
        giftCents += GIFT_PACKAGING_CENTS * item.quantity;
      }
      return {
        product_id: product.id,
        product_name: product.name,
        quantity: item.quantity,
        color: item.color ?? '',
        size: item.size ?? '',
        gift_packaging: Boolean(item.giftPackaging),
        unit_price_cents: Math.round(product.price * 100),
      };
    });

    const shippingCents = subtotalCents >= FREE_SHIPPING_CENTS_THRESHOLD ? 0 : SHIPPING_CENTS;
    const totalCents = subtotalCents + giftCents + shippingCents;

    const orderNumber = `ZRY-${Date.now().toString().slice(-6)}`;

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_number: orderNumber,
        email: address.email ?? '',
        status: paymentMethod === 'stripe' ? 'pending' : 'cod_pending',
        payment_method: paymentMethod,
        subtotal_cents: subtotalCents,
        gift_packaging_cents: giftCents,
        shipping_cents: shippingCents,
        total_cents: totalCents,
        currency: CURRENCY,
        shipping_address: address,
      })
      .select('id')
      .single();

    if (orderError) {
      throw new Error(orderError.message);
    }

    const { error: itemsError } = await supabase.from('order_items').insert(
      orderItems.map((item) => ({ ...item, order_id: order.id })),
    );
    if (itemsError) {
      throw new Error(itemsError.message);
    }

    for (const item of items) {
      const { error: stockError } = await supabase.rpc('decrement_stock', {
        p_id: item.productId,
        p_quantity: item.quantity,
      });
      if (stockError) {
        throw new Error(stockError.message);
      }
    }

    if (paymentMethod === 'stripe') {
      const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
      const siteUrl = Deno.env.get('SITE_URL') ?? 'http://localhost:4200';

      const session = await fetch('https://api.stripe.com/v1/checkout/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeSecret}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          mode: 'payment',
          currency: CURRENCY,
          client_reference_id: order.id,
          'metadata[orderId]': order.id,
          'metadata[orderNumber]': orderNumber,
          customer_email: address.email ?? '',
          success_url: `${siteUrl}/order-confirmation?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${siteUrl}/checkout`,
          ...(shippingCents >= 0
            ? {
                'shipping_options[0][shipping_rate_data][type]': 'fixed_amount',
                'shipping_options[0][shipping_rate_data][fixed_amount][amount]': String(shippingCents),
                'shipping_options[0][shipping_rate_data][fixed_amount][currency]': CURRENCY,
                'shipping_options[0][shipping_rate_data][display_name]':
                  shippingCents === 0 ? 'Free shipping' : 'Standard shipping',
              }
            : {}),
        }).toString(),
      });

      const sessionBody = (await session.json()) as { url?: string; id?: string; error?: { message: string } };

      if (!session.ok || !sessionBody.url) {
        throw new Error(sessionBody.error?.message ?? 'Stripe could not create a checkout session.');
      }

      await supabase.from('orders').update({ stripe_session_id: sessionBody.id }).eq('id', order.id);

      return json({ orderId: order.id, orderNumber, sessionUrl: sessionBody.url });
    }

    return json({ orderId: order.id, orderNumber });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not create your order.' }, 400);
  }
});