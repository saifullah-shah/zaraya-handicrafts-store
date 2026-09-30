import { createClient } from 'npm:@supabase/supabase-js@2';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return diff === 0;
}

const encoder = new TextEncoder();

function parseSignature(header: string): { timestamp: number; signatures: string[] } {
  const values = new Map<string, string[]>();
  for (const part of header.split(',')) {
    const separator = part.indexOf('=');
    if (separator <= 0) {
      continue;
    }
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    const current = values.get(key) ?? [];
    current.push(value);
    values.set(key, current);
  }
  const timestampText = values.get('t')?.[0];
  const signatures = values.get('v1') ?? [];
  if (!timestampText || !/^\d+$/.test(timestampText) || signatures.length === 0) {
    throw new Error('Malformed Stripe signature header.');
  }
  return { timestamp: Number(timestampText), signatures };
}

async function verifyStripeSignature(body: string, signatureHeader: string | null, secret: string): Promise<void> {
  if (!signatureHeader || !secret) {
    throw new Error('Missing Stripe signature or webhook secret.');
  }
  const { timestamp, signatures } = parseSignature(signatureHeader);
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) {
    throw new Error('Stripe event timestamp is out of range.');
  }
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${body}`));
  const expected = [...new Uint8Array(mac)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
  if (!signatures.some((signature) => timingSafeEqual(expected, signature))) {
    throw new Error('Stripe signature mismatch.');
  }
}

interface StripeSession {
  id?: string;
  amount_total?: number;
  currency?: string;
  payment_status?: string;
  payment_intent?: string | null;
  client_reference_id?: string | null;
  metadata?: Record<string, string>;
}

interface StripeCharge {
  id?: string;
  payment_intent?: string | { id?: string } | null;
  amount?: number;
  amount_refunded?: number;
  currency?: string;
  metadata?: Record<string, string>;
}

interface StripeEvent {
  id: string;
  type: string;
  data: { object: StripeSession | StripeCharge };
}

const sessionEvents = new Set([
  'checkout.session.completed',
  'checkout.session.expired',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
]);

const chargeEvents = new Set([
  'charge.refunded',
  'charge.dispute.created',
]);

function orderIdFromEvent(event: StripeEvent): string | null {
  const object = event.data.object as StripeSession;
  const value = object.metadata?.['orderId'] ?? object.client_reference_id;
  if (!value) {
    return null;
  }
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204 });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed.' }, 405);
  }

  const rawBody = await req.text();
  try {
    await verifyStripeSignature(
      rawBody,
      req.headers.get('stripe-signature'),
      Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '',
    );
    const event = JSON.parse(rawBody) as StripeEvent;
    if (!event.id || !event.type) {
      return json({ error: 'Invalid Stripe event.' }, 400);
    }
    if (!chargeEvents.has(event.type) && !sessionEvents.has(event.type)) {
      return json({ received: true, ignored: true });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    if (chargeEvents.has(event.type)) {
      const charge = event.data.object as StripeCharge;
      const paymentIntentValue = charge.payment_intent;
      const paymentIntent =
        typeof paymentIntentValue === 'string'
          ? paymentIntentValue
          : paymentIntentValue?.id ?? charge.metadata?.['orderId'] ?? null;
      const amount = event.type === 'charge.refunded' ? charge.amount_refunded : charge.amount;
      if (!paymentIntent || !Number.isInteger(amount) || (amount ?? 0) < 0 || !charge.currency) {
        return json({ error: 'Stripe charge payload is invalid.' }, 400);
      }
      const { data, error } = await supabase.rpc('process_stripe_charge_event', {
        p_event_id: event.id,
        p_type: event.type,
        p_payment_intent_id: paymentIntent,
        p_amount_cents: amount,
        p_currency: charge.currency,
        p_payload: charge,
      });
      if (error) {
        console.error('Stripe charge event processing failed:', error.message);
        const status =
          error.message.includes('ORDER_NOT_FOUND') || error.message.includes('STRIPE_AMOUNT_MISMATCH')
            ? 400
            : 500;
        return json({ error: 'Stripe event could not be processed.' }, status);
      }
      return json({ received: true, result: data });
    }

    const session = event.data.object as StripeSession;
    if (!session.id) {
      return json({ error: 'Stripe session id is missing.' }, 400);
    }
    if (!Number.isInteger(session.amount_total) || (session.amount_total ?? 0) < 0 || !session.currency) {
      return json({ error: 'Stripe session amount is invalid.' }, 400);
    }

    const { data, error } = await supabase.rpc('process_stripe_event', {
      p_event_id: event.id,
      p_type: event.type,
      p_session_id: session.id,
      p_order_id: orderIdFromEvent(event),
      p_amount_total: session.amount_total,
      p_currency: session.currency,
      p_payment_status: session.payment_status ?? '',
      p_payment_intent_id: session.payment_intent ?? null,
      p_payload: session,
    });
    if (error) {
      console.error('Stripe webhook processing failed:', error.message);
      const status = error.message.includes('ORDER_NOT_FOUND') || error.message.includes('STRIPE_AMOUNT_MISMATCH') ? 400 : 500;
      return json({ error: 'Stripe event could not be processed.' }, status);
    }
    return json({ received: true, result: data });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : 'Webhook processing failed.' },
      400,
    );
  }
});
