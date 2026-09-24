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

The storefront integrates with **Supabase** (catalog + orders) and **Stripe** (hosted Checkout), with a **cash on delivery** fallback payment method. When no project credentials are configured, the app runs in demo mode using the static catalog and completes COD-style orders locally — the UI never breaks.

### Architecture

- `src/environments/environment.{ts,prod.ts}` — public config (Supabase URL/anon key, site URL).
- `src/app/services/supabase.service.ts` — Supabase client; `configured` flag powers graceful fallback.
- `src/app/services/product.service.ts` — product catalog signal, seeded from static data, refreshed from the `products` table.
- `src/app/services/pricing.service.ts` — pricing rules (gift packaging +$12, $18 flat shipping / free over $200).
- `src/app/services/checkout.service.ts` — invokes the `create-order` edge function; falls back to demo COD.
- `src/app/pages/checkout.page.ts` — reactive shipping form + Stripe/COD payment selection.
- `supabase/migrations/` — schema: `products`, `orders`, `order_items` (integer cents), RLS, seed.
- `supabase/functions/create-order/` — validates prices server-side, records the order, decrements stock, creates a Stripe Checkout Session (or COD order).
- `supabase/functions/stripe-webhook/` — verifies signatures (HMAC) and marks orders paid/cancelled.

### 1. Configure the storefront

Edit `src/environments/environment.ts` (and `environment.prod.ts`):

```ts
supabaseUrl: 'https://YOUR_PROJECT_REF.supabase.co',
supabaseAnonKey: 'YOUR_SUPABASE_ANON_KEY',
siteUrl: 'http://localhost:4200', // prod: deployed domain
```

### 2. Set up Supabase

```bash
supabase init
supabase link --project-ref YOUR_PROJECT_REF
supabase db push        # applies supabase/migrations
supabase functions deploy create-order
supabase functions deploy stripe-webhook
supabase secrets set --env-file supabase/.env
```

Copy `supabase/.env.example` to `supabase/.env` and set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL`. To test functions locally:

```bash
supabase functions serve --env-file supabase/.env
```

### 3. Configure Stripe

1. Create a webhook endpoint in the [Stripe dashboard](https://dashboard.stripe.com/webhooks) pointing at your deployed `stripe-webhook` function URL, with events `checkout.session.completed` and `checkout.session.expired`.
2. Use the generated signing secret as `STRIPE_WEBHOOK_SECRET` (run `stripe listen --forward-to ...` with the CLI for local testing).
3. COD orders are stored as `cod_pending` — mark them `fulfilled` or `cancelled` in the Supabase dashboard as they're shipped.

### Demo mode

With placeholder credentials the checkout still works: the cart totals, form validation, and confirmation page all run locally, and Stripe/COD orders are simulated. Everything switches to the real backend automatically once the Supabase URL/anon key and Stripe secrets are set.
