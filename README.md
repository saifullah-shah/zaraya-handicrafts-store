# ZarayaHandicraftsStore

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.8.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Backend & payments

The storefront integrates with **Supabase** (catalog, orders, CMS) and **Stripe** (hosted Checkout), with a **cash on delivery** option. Checkout is **fail-closed**: without valid Supabase credentials the catalog renders from static data, but checkout is disabled rather than faking an order.

### Architecture

- `src/environments/environment.{ts,prod.ts}` — public config (Supabase URL/anon key, site URL). No secrets.
- `src/app/services/supabase.service.ts` — Supabase client plus Edge Function accessors.
- `src/app/services/product.service.ts` — catalog signal seeded from static data, refreshed from `products`.
- `src/app/services/store-settings.service.ts` — shipping, free-shipping threshold, gift packaging, currency, site name, announcement.
- `src/app/services/content.service.ts` — CMS home sections (hero, collections, benefits, story, reviews, FAQ) with static fallbacks.
- `src/app/services/pricing.service.ts` — **display-only** price estimates; the server is authoritative.
- `src/app/services/checkout.service.ts` — invokes `create-order`; surfaces a real error when the backend rejects the order.
- `src/app/services/customer-auth.service.ts` + `src/app/pages/{login,account}.page.ts` — email/password accounts and owned-order history.
- `supabase/migrations/` — schema, RLS, and transactional RPCs (see migration order below).
- `supabase/functions/create-order/` — validates the cart and address, derives totals from the database, reserves stock atomically, rate-limits, enforces idempotency, and returns an HMAC-derived confirmation token plus a Stripe Checkout URL.
- `supabase/functions/stripe-webhook/` — verifies the Stripe signature, deduplicates events, and settles/refunds/disputes orders through `process_stripe_event` / `process_stripe_charge_event`.
- `supabase/functions/order-status/` — capability-token order status, with Stripe session ownership verification before reporting a paid order.

### Money and stock rules

- All money is integer **cents**; `price`/`shipping_flat` dollar columns are legacy mirrors kept in sync by the admin UI and never read by checkout.
- Shipping, gift packaging, and the free-shipping threshold come from `store_settings` (admin-editable).
- COD orders reserve stock and expire via `release_expired_cod_orders` (scheduled by `pg_cron` when available).
- Stock is released on Stripe session failure, session expiry, and cancellation/refund transitions.

### 1. Configure the storefront

Edit `src/environments/environment.ts` (and `environment.prod.ts`):

```ts
supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
siteUrl: 'http://localhost:4200', // prod: deployed domain
```

### 2. Apply migrations in order

```bash
supabase init
supabase link --project-ref YOUR_PROJECT_REF
supabase db push   # 23000 schema -> 25000 CMS -> 26000 integrity -> 26010 transactional -> 26020 cron
```

Verify `store_settings` contains numeric values for `shipping_fee_cents`, `free_shipping_threshold_cents`, and `gift_packaging_cents` after migrating.

### 3. Deploy functions and secrets

```bash
cp supabase/.env.example supabase/.env   # then fill in real values
supabase secrets set --env-file supabase/.env
supabase functions deploy create-order
supabase functions deploy stripe-webhook
supabase functions deploy order-status
```

`supabase/config.toml` keeps `verify_jwt = false` for these three functions (guest checkout and Stripe webhooks have no Supabase JWT). Abuse controls are the strict `SITE_URL` origin check, per-IP and per-email rate limits, stock caps, and idempotency keys — do not re-enable JWT verification without also adding auth.

To test locally: `supabase functions serve --env-file supabase/.env`.

### 4. Configure Stripe

1. Create a webhook endpoint in the [Stripe dashboard](https://dashboard.stripe.com/webhooks) pointing at the deployed `stripe-webhook` function, subscribing to `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`, and `charge.dispute.closed`.
2. Set the signing secret as `STRIPE_WEBHOOK_SECRET` (use `stripe listen --forward-to ...` locally).
3. COD orders stay `cod_pending` until an admin marks them paid, then ships them through the admin order detail transitions.

### 5. Supabase dashboard settings

- **Auth → URL Configuration**: Site URL = deployed domain; add local dev origins as needed for email redirects.
- **Auth → Providers**: Email provider enabled (customer accounts and admin logins).
- **Storage**: `product-images` bucket is public-read, writes restricted to admins by RLS.
- **SQL Editor grants**: `SECURITY DEFINER` RPCs are granted to `service_role` only.

### 6. Rotate leaked credentials

The Pexels key that was previously committed must be revoked in the Pexels dashboard. Pexels is now an optional progressive enhancement: it runs only when `window.__ZARAYA_PEXELS_KEY__` is defined at runtime, and the storefront works without it.
