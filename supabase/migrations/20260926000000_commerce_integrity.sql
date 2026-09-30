alter table public.content_sections
  drop constraint if exists content_sections_page_key_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_sections_page_key_sort_key'
      and conrelid = 'public.content_sections'::regclass
  ) and not exists (
    select 1
    from public.content_sections
    group by page, key, sort
    having count(*) > 1
  ) then
    alter table public.content_sections
      add constraint content_sections_page_key_sort_key
      unique (page, key, sort);
  end if;
end;
$$;

alter table public.products
  add column if not exists price_cents integer,
  add column if not exists compare_at_price_cents integer,
  add column if not exists sku text,
  add column if not exists is_active boolean not null default true,
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at timestamptz;

update public.products
set price_cents = round(price::numeric * 100)::integer
where price_cents is null;

update public.products
set compare_at_price_cents = round(compare_at_price::numeric * 100)::integer
where compare_at_price is not null and compare_at_price_cents is null;

alter table public.products
  alter column price_cents set not null;

drop policy if exists "Users can read their own orders" on public.orders;
create policy "Users can read their own orders"
  on public.orders for select
  using (auth.uid() = user_id);

drop policy if exists "Users can read their own order items" on public.order_items;
create policy "Users can read their own order items"
  on public.order_items for select
  using (
    order_id in (
      select id from public.orders where auth.uid() = user_id
    )
  );

drop policy if exists "Products are publicly readable" on public.products;
create policy "Products are publicly readable"
  on public.products for select
  using (is_active = true and archived_at is null);
create policy "Admins can read all products"
  on public.products for select
  using (public.is_current_admin());

alter table public.orders
  add column if not exists idempotency_key text,
  add column if not exists confirmation_token_hash text,
  add column if not exists customer_phone text,
  add column if not exists gift_packaging_unit_cents integer,
  add column if not exists payment_status text not null default 'pending',
  add column if not exists stripe_payment_intent_id text,
  add column if not exists stripe_checkout_url text,
  add column if not exists billing_address jsonb,
  add column if not exists tax_cents integer not null default 0,
  add column if not exists discount_cents integer not null default 0,
  add column if not exists shipping_method text,
  add column if not exists tracking_number text,
  add column if not exists customer_note text,
  add column if not exists paid_at timestamptz,
  add column if not exists cancelled_at timestamptz,
  add column if not exists fulfilled_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.order_items
  add column if not exists sku text,
  add column if not exists product_slug text,
  add column if not exists product_image_url text,
  add column if not exists gift_message text;

create table if not exists public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references auth.users(id) on delete set null,
  source text not null default 'app',
  reason text,
  created_at timestamptz not null default now()
);

create table if not exists public.inventory_movements (
  id bigint generated always as identity primary key,
  product_id text not null references public.products(id) on delete restrict,
  order_id uuid references public.orders(id) on delete set null,
  delta integer not null,
  reason text not null,
  actor_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  provider text not null,
  provider_reference text not null,
  amount_cents bigint not null,
  currency text not null,
  status text not null,
  captured_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  unique (provider, provider_reference)
);

create table if not exists public.stripe_events (
  event_id text primary key,
  type text not null,
  payload jsonb,
  received_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists order_events_order_id_created_idx
  on public.order_events(order_id, created_at desc);
create index if not exists inventory_movements_product_id_created_idx
  on public.inventory_movements(product_id, created_at desc);
create index if not exists payments_order_id_created_idx
  on public.payments(order_id, created_at desc);
create index if not exists orders_status_created_idx
  on public.orders(status, created_at desc);
create index if not exists orders_created_idx
  on public.orders(created_at desc);
create index if not exists order_items_product_id_idx
  on public.order_items(product_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_product_price_cents()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    if new.price_cents is null then
      new.price_cents = round(new.price::numeric * 100)::integer;
    end if;
    if new.compare_at_price is null then
      new.compare_at_price_cents = null;
    elsif new.compare_at_price_cents is null then
      new.compare_at_price_cents = round(new.compare_at_price::numeric * 100)::integer;
    end if;
    return new;
  end if;

  if new.price_cents is null or (new.price is distinct from old.price and new.price_cents is not distinct from old.price_cents) then
    new.price_cents = round(new.price::numeric * 100)::integer;
  end if;
  if new.compare_at_price is null then
    new.compare_at_price_cents = null;
  elsif new.compare_at_price_cents is null or new.compare_at_price is distinct from old.compare_at_price then
    new.compare_at_price_cents = round(new.compare_at_price::numeric * 100)::integer;
  end if;
  return new;
end;
$$;

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

drop trigger if exists products_sync_price_cents on public.products;
create trigger products_sync_price_cents
before insert or update on public.products
for each row execute function public.sync_product_price_cents();

alter table public.products
  add constraint products_price_cents_nonnegative check (price_cents >= 0),
  add constraint products_stock_nonnegative check (stock >= 0),
  add constraint products_rating_range check (rating is null or rating between 0 and 5),
  add constraint products_reviews_nonnegative check (reviews is null or reviews >= 0),
  add constraint products_compare_price_valid check (
    compare_at_price_cents is null or compare_at_price_cents >= price_cents
  );

alter table public.orders
  add constraint orders_payment_status_valid check (
    payment_status in ('pending', 'paid', 'failed', 'cancelled', 'refunded', 'partially_refunded', 'disputed')
  ),
  add constraint orders_amounts_nonnegative check (
    subtotal_cents >= 0 and gift_packaging_cents >= 0 and shipping_cents >= 0
    and tax_cents >= 0 and discount_cents >= 0 and total_cents >= 0
    and (gift_packaging_unit_cents is null or gift_packaging_unit_cents >= 0)
  ),
  add constraint orders_total_matches_lines check (
    total_cents = subtotal_cents + gift_packaging_cents + shipping_cents + tax_cents - discount_cents
  ),
  add constraint orders_shipping_address_present check (
    shipping_address ?& array['fullName', 'email', 'street', 'city', 'country']
  ) not valid;

alter table public.order_items
  add constraint order_items_quantity_range check (quantity between 1 and 99),
  add constraint order_items_unit_price_nonnegative check (unit_price_cents >= 0);

create unique index if not exists products_sku_unique
  on public.products(sku) where sku is not null and sku <> '';

do $$
begin
  if exists (
    select 1 from public.orders
    where stripe_session_id is not null
    group by stripe_session_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate Stripe session IDs exist; resolve them before applying unique constraints.';
  end if;
end;
$$;

create unique index if not exists orders_stripe_session_unique
  on public.orders(stripe_session_id) where stripe_session_id is not null;

create unique index if not exists orders_idempotency_unique
  on public.orders(idempotency_key) where idempotency_key is not null;

create unique index if not exists orders_confirmation_token_unique
  on public.orders(confirmation_token_hash) where confirmation_token_hash is not null;

alter table public.order_events enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.payments enable row level security;
alter table public.stripe_events enable row level security;

create policy "Admins can read order events"
  on public.order_events for select
  using (public.is_current_admin());

create policy "Admins can read inventory movements"
  on public.inventory_movements for select
  using (public.is_current_admin());

create policy "Admins can read payments"
  on public.payments for select
  using (public.is_current_admin());

revoke all on table public.order_events from anon, authenticated;
revoke all on table public.inventory_movements from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.stripe_events from anon, authenticated;
grant select on table public.order_events to authenticated;
grant select on table public.inventory_movements to authenticated;
grant select on table public.payments to authenticated;

drop policy if exists "Admins can update orders" on public.orders;
drop policy if exists "Admins can read all orders" on public.orders;
create policy "Admins can read all orders"
  on public.orders for select
  using (public.is_current_admin());

drop policy if exists "Admins can read all order items" on public.order_items;
create policy "Admins can read all order items"
  on public.order_items for select
  using (public.is_current_admin());

revoke insert, update, delete on table public.orders from anon, authenticated;
revoke insert, update, delete on table public.order_items from anon, authenticated;
revoke all on function public.decrement_stock(text, integer) from public, anon, authenticated;

alter type public.order_status add value if not exists 'processing' after 'paid';
alter type public.order_status add value if not exists 'shipped' after 'processing';
alter type public.order_status add value if not exists 'delivered' after 'shipped';
alter type public.order_status add value if not exists 'payment_failed' after 'cancelled';
alter type public.order_status add value if not exists 'refunded' after 'payment_failed';
alter type public.order_status add value if not exists 'partially_refunded' after 'refunded';
alter type public.order_status add value if not exists 'returned' after 'partially_refunded';
