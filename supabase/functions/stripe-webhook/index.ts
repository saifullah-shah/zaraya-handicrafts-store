import { createClient } from 'npm:@supabase/supabase-js@2';

function json(body: unknown, status = 200) {
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
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

const encoder = new TextEncoder();

async function verifyStripeSignature(body: string, signatureHeader: string | null, secret: string): Promise<void> {
  if (!signatureHeader || !secret) {
    throw new Error('Missing Stripe signature or webhook secret.');
  }

  const parts = new Map(
    signatureHeader
      .split(',')
      .map((pair) => pair.trim().split('='))
      .map(([key, value]) => [key, value]),
  );
  const timestamp = parts.get('t');
  const signature = parts.get('v1');
  if (!timestamp || !signature) {
    throw new Error('Malformed Stripe signature header.');
  }

  const signedPayload = `${timestamp}.${body}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');

  if (!timingSafeEqual(expected, signature)) {
    throw new Error('Stripe signature mismatch.');
  }

  const toleranceSeconds = 300;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) {
    throw new Error('Stripe event timestamp is out of range.');
  }
}

interface StripeEvent {
  type: string;
  data: { object: { id?: string; metadata?: Record<string, string> } };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } });
  }

  const rawBody = await req.text();
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

  try {
    await verifyStripeSignature(rawBody, req.headers.get('stripe-signature'), secret);

    const event = JSON.parse(rawBody) as StripeEvent;
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    if (event.type === 'checkout.session.completed') {
      const sessionId = event.data.object.id;
      await supabase.from('orders').update({ status: 'paid' }).eq('stripe_session_id', sessionId);
    } else if (event.type === 'checkout.session.expired') {
      const sessionId = event.data.object.id;
      await supabase.from('orders').update({ status: 'cancelled' }).eq('stripe_session_id', sessionId);
    }

    return json({ received: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Webhook processing failed.' }, 400);
  }
});