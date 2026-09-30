create or replace function public.create_order_atomic(
  p_items jsonb,
  p_address jsonb,
  p_payment_method text,
  p_user_id uuid default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_product public.products%rowtype;
  v_existing public.orders%rowtype;
  v_quantity_text text;
  v_quantity integer;
  v_product_id text;
  v_color text;
  v_size text;
  v_gift boolean;
  v_unit_cents integer;
  v_subtotal bigint := 0;
  v_gift_total bigint := 0;
  v_shipping integer;
  v_tax integer := 0;
  v_discount integer := 0;
  v_total bigint;
  v_order_id uuid;
  v_order_number text;
  v_initial_status public.order_status;
  v_lines jsonb := '[]'::jsonb;
  v_email text;
  v_full_name text;
  v_phone text;
  v_street text;
  v_city text;
  v_state text;
  v_postal_code text;
  v_country text;
  v_gift_fee integer;
  v_shipping_fee integer;
  v_free_shipping_threshold integer;
begin
  if p_payment_method is null or p_payment_method not in ('stripe', 'cod') then
    raise exception using errcode = '22023', message = 'UNSUPPORTED_PAYMENT_METHOD';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'EMPTY_ORDER';
  end if;

  if jsonb_array_length(p_items) > 50 then
    raise exception using errcode = '22023', message = 'TOO_MANY_ORDER_ITEMS';
  end if;

  if p_address is null or jsonb_typeof(p_address) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_ADDRESS';
  end if;

  v_full_name := btrim(coalesce(p_address ->> 'fullName', ''));
  v_email := lower(btrim(coalesce(p_address ->> 'email', '')));
  v_phone := btrim(coalesce(p_address ->> 'phone', ''));
  v_street := btrim(coalesce(p_address ->> 'street', ''));
  v_city := btrim(coalesce(p_address ->> 'city', ''));
  v_state := btrim(coalesce(p_address ->> 'state', ''));
  v_postal_code := btrim(coalesce(p_address ->> 'postalCode', ''));
  v_country := btrim(coalesce(p_address ->> 'country', ''));

  if v_full_name = '' or length(v_full_name) > 120
    or v_email = '' or length(v_email) > 254 or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+$'
    or v_street = '' or length(v_street) > 240
    or v_city = '' or length(v_city) > 100
    or v_country = '' or length(v_country) > 100 then
    raise exception using errcode = '22023', message = 'INVALID_ADDRESS';
  end if;

  if p_user_id is not null and not exists (select 1 from auth.users where id = p_user_id) then
    raise exception using errcode = '22023', message = 'INVALID_USER';
  end if;

  select case
           when value ~ '^\d{1,9}$' then (value #>> '{}')::integer
           else 1200
         end
    into v_gift_fee
    from public.store_settings
   where key = 'gift_packaging_cents';

  select case
           when value ~ '^\d{1,9}$' then (value #>> '{}')::integer
           else 1800
         end
    into v_shipping_fee
    from public.store_settings
   where key = 'shipping_fee_cents';

  select case
           when value ~ '^\d{1,9}$' then (value #>> '{}')::integer
           else 20000
         end
    into v_free_shipping_threshold
    from public.store_settings
   where key = 'free_shipping_threshold_cents';

  v_shipping_fee := coalesce(v_shipping_fee, 1800);
  v_free_shipping_threshold := coalesce(v_free_shipping_threshold, 20000);
  v_gift_fee := coalesce(v_gift_fee, 1200);

  if nullif(btrim(p_idempotency_key), '') is not null then
    perform pg_advisory_xact_lock(hashtextextended(btrim(p_idempotency_key), 0));
    select * into v_existing
      from public.orders
     where idempotency_key = btrim(p_idempotency_key)
     for update;
    if found then
      return jsonb_build_object(
        'orderId', v_existing.id,
        'orderNumber', v_existing.order_number,
        'status', v_existing.status,
        'paymentMethod', v_existing.payment_method,
        'stripeCheckoutUrl', v_existing.stripe_checkout_url,
        'subtotalCents', v_existing.subtotal_cents,
        'giftPackagingCents', v_existing.gift_packaging_cents,
        'shippingCents', v_existing.shipping_cents,
        'taxCents', v_existing.tax_cents,
        'discountCents', v_existing.discount_cents,
        'totalCents', v_existing.total_cents,
        'currency', v_existing.currency
      );
    end if;
  end if;

  perform p.id
    from public.products p
   where p.id in (
     select btrim(item.value ->> 'productId')
       from jsonb_array_elements(p_items) as item(value)
   )
   order by p.id
   for update;

  if p_payment_method = 'cod' then
    if exists (
      select 1
        from public.orders
       where payment_method = 'cod'
         and status = 'cod_pending'
         and email = lower(btrim(coalesce(p_address ->> 'email', '')))
         and created_at > now() - interval '24 hours'
    ) then
      raise exception using errcode = 'P0001', message = 'COD_LIMIT_REACHED';
    end if;
  end if;

  for v_item in select value from jsonb_array_elements(p_items) as item(value)
  loop
    if jsonb_typeof(v_item) <> 'object' or not (v_item ? 'productId') then
      raise exception using errcode = '22023', message = 'INVALID_ORDER_ITEM';
    end if;

    v_product_id := btrim(v_item ->> 'productId');
    v_quantity_text := v_item ->> 'quantity';
    v_color := btrim(coalesce(v_item ->> 'color', ''));
    v_size := btrim(coalesce(v_item ->> 'size', ''));

    if v_product_id = '' or v_quantity_text is null or v_quantity_text !~ '^[1-9][0-9]{0,1}$' then
      raise exception using errcode = '22023', message = 'INVALID_QUANTITY';
    end if;

    v_quantity := v_quantity_text::integer;
    if v_item -> 'giftPackaging' is null or jsonb_typeof(v_item -> 'giftPackaging') <> 'boolean' then
      raise exception using errcode = '22023', message = 'INVALID_GIFT_PACKAGING';
    end if;
    v_gift := (v_item ->> 'giftPackaging')::boolean;

    select * into v_product
      from public.products
     where id = v_product_id
       and is_active = true
       and archived_at is null
     for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'PRODUCT_NOT_FOUND';
    end if;

    if coalesce(v_product.stock, 0) < v_quantity then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_STOCK:' || v_product_id;
    end if;

    if v_color <> '' and not (v_color = any(coalesce(v_product.colors, ARRAY[]::text[]))) then
      raise exception using errcode = '22023', message = 'INVALID_COLOR';
    end if;

    if v_size <> '' and not (v_size = any(coalesce(v_product.sizes, ARRAY[]::text[]))) then
      raise exception using errcode = '22023', message = 'INVALID_SIZE';
    end if;

    if v_gift and not coalesce(v_product.gift_packaging, false) then
      raise exception using errcode = '22023', message = 'GIFT_PACKAGING_UNAVAILABLE';
    end if;

    v_unit_cents := v_product.price_cents;
    v_subtotal := v_subtotal + v_unit_cents::bigint * v_quantity;
    if v_gift then
      v_gift_total := v_gift_total + v_gift_fee::bigint * v_quantity;
    end if;

    update public.products
       set stock = stock - v_quantity
     where id = v_product.id;

    v_lines := v_lines || jsonb_build_array(
      jsonb_build_object(
        'product_id', v_product.id,
        'product_name', v_product.name,
        'product_slug', v_product.slug,
        'product_image_url', nullif(v_product.images[1], ''),
        'sku', v_product.sku,
        'quantity', v_quantity,
        'color', nullif(v_color, ''),
        'size', nullif(v_size, ''),
        'gift_packaging', v_gift,
        'unit_price_cents', v_unit_cents
      )
    );
  end loop;

  v_shipping := case when v_subtotal >= v_free_shipping_threshold then 0 else v_shipping_fee end;
  v_total := v_subtotal + v_gift_total + v_shipping + v_tax - v_discount;
  v_initial_status := case when p_payment_method = 'cod' then 'cod_pending'::public.order_status else 'pending'::public.order_status end;
  v_order_number := 'ZRY-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.orders (
    user_id,
    order_number,
    email,
    customer_phone,
    shipping_address,
    billing_address,
    subtotal_cents,
    gift_packaging_cents,
    gift_packaging_unit_cents,
    shipping_cents,
    tax_cents,
    discount_cents,
    total_cents,
    currency,
    status,
    payment_status,
    payment_method,
    shipping_method,
    idempotency_key,
    customer_note
  ) values (
    p_user_id,
    v_order_number,
    v_email,
    nullif(v_phone, ''),
    jsonb_build_object(
      'fullName', v_full_name,
      'email', v_email,
      'phone', nullif(v_phone, ''),
      'street', v_street,
      'city', v_city,
      'state', nullif(v_state, ''),
      'postalCode', nullif(v_postal_code, ''),
      'country', v_country
    ),
    case
      when jsonb_typeof(p_address -> 'billingAddress') = 'object' then p_address -> 'billingAddress'
      else jsonb_build_object(
        'fullName', v_full_name,
        'email', v_email,
        'phone', nullif(v_phone, ''),
        'street', v_street,
        'city', v_city,
        'state', nullif(v_state, ''),
        'postalCode', nullif(v_postal_code, ''),
        'country', v_country
      )
    end,
    v_subtotal,
    v_gift_total,
    v_gift_fee,
    v_shipping,
    v_tax,
    v_discount,
    v_total,
    'usd',
    v_initial_status,
    'pending',
    p_payment_method,
    'standard',
    nullif(btrim(p_idempotency_key), ''),
    nullif(btrim(coalesce(p_address ->> 'note', '')), '')
  ) returning id into v_order_id;

  insert into public.order_items (
    order_id,
    product_id,
    product_name,
    product_slug,
    product_image_url,
    sku,
    unit_price_cents,
    quantity,
    color,
    size,
    gift_packaging
  )
  select
    v_order_id,
    line ->> 'product_id',
    line ->> 'product_name',
    line ->> 'product_slug',
    line ->> 'product_image_url',
    line ->> 'sku',
    (line ->> 'unit_price_cents')::integer,
    (line ->> 'quantity')::integer,
    coalesce(line ->> 'color', ''),
    coalesce(line ->> 'size', ''),
    (line ->> 'gift_packaging')::boolean
  from jsonb_array_elements(v_lines) as lines(line);

  for v_item in select value from jsonb_array_elements(v_lines) as item(value)
  loop
    insert into public.inventory_movements (
      product_id,
      order_id,
      delta,
      reason
    ) values (
      v_item ->> 'product_id',
      v_order_id,
      -((v_item ->> 'quantity')::integer),
      'order_reserved'
    );
  end loop;

  insert into public.order_events (order_id, to_status, source, reason)
  values (v_order_id, v_initial_status, 'system', 'order_created');

  return jsonb_build_object(
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'status', v_initial_status,
    'subtotalCents', v_subtotal,
    'giftPackagingCents', v_gift_total,
    'shippingCents', v_shipping,
    'taxCents', v_tax,
    'discountCents', v_discount,
    'totalCents', v_total,
    'currency', 'usd',
    'giftPackagingUnitCents', v_gift_fee
  );
end;
$$;

create or replace function public.release_order_stock(
  p_order_id uuid,
  p_reason text default 'cancelled',
  p_allow_paid boolean default false
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item public.order_items%rowtype;
begin
  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    return false;
  end if;

  if v_order.status not in ('pending', 'cod_pending')
    and not (p_allow_paid and v_order.status in ('paid', 'processing', 'fulfilled', 'shipped')) then
    return false;
  end if;

  for v_item in
    select * from public.order_items where order_id = p_order_id
  loop
    if not exists (
      select 1 from public.products
       where id = v_item.product_id
         and stock <= 2147483647 - v_item.quantity
    ) then
      raise exception using errcode = '22003', message = 'STOCK_OVERFLOW';
    end if;

    update public.products
       set stock = stock + v_item.quantity
     where id = v_item.product_id;

    insert into public.inventory_movements (
      product_id,
      order_id,
      delta,
      reason
    ) values (
      v_item.product_id,
      p_order_id,
      v_item.quantity,
      coalesce(nullif(btrim(p_reason), ''), 'stock_released')
    );
  end loop;

  if not p_allow_paid then
    update public.orders
       set status = 'cancelled',
           payment_status = 'cancelled',
           cancelled_at = now()
     where id = p_order_id;
  end if;

  insert into public.order_events (order_id, from_status, to_status, source, reason)
  values (p_order_id, v_order.status, case when p_allow_paid then v_order.status else 'cancelled' end, 'system', coalesce(nullif(btrim(p_reason), ''), 'stock_released'));

  return true;
end;
$$;

create or replace function public.process_stripe_event(
  p_event_id text,
  p_type text,
  p_session_id text,
  p_order_id uuid,
  p_amount_total bigint,
  p_currency text,
  p_payment_status text,
  p_payment_intent_id text default null,
  p_payload jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_inserted integer;
  v_paid boolean := false;
  v_released boolean := false;
  v_payment_reference text;
  v_manual_review boolean := false;
begin
  if nullif(btrim(p_event_id), '') is null or nullif(btrim(p_session_id), '') is null then
    raise exception using errcode = '22023', message = 'INVALID_STRIPE_EVENT';
  end if;

  insert into public.stripe_events (event_id, type, payload)
  values (p_event_id, p_type, p_payload)
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('duplicate', true, 'eventId', p_event_id);
  end if;

  if p_order_id is null then
    select * into v_order
      from public.orders
     where stripe_session_id = p_session_id
     for update;
  else
    select * into v_order
      from public.orders
     where id = p_order_id
       and stripe_session_id = p_session_id
     for update;
  end if;

  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  if p_amount_total is null or p_amount_total <> v_order.total_cents
    or lower(coalesce(p_currency, '')) <> lower(v_order.currency) then
    raise exception using errcode = '22023', message = 'STRIPE_AMOUNT_MISMATCH';
  end if;

  v_payment_reference := coalesce(nullif(btrim(p_payment_intent_id), ''), p_session_id);

  if p_type in ('checkout.session.completed', 'checkout.session.async_payment_succeeded')
    and p_payment_status = 'paid' then
    if v_order.status in ('pending', 'cod_pending') then
      v_paid := true;
      insert into public.order_events (order_id, from_status, to_status, source, reason)
      values (v_order.id, v_order.status, 'paid', 'stripe', 'payment_confirmed');

      update public.orders
         set status = 'paid',
             payment_status = 'paid',
             stripe_payment_intent_id = v_payment_reference,
             paid_at = coalesce(paid_at, now())
       where id = v_order.id;
    else
      v_manual_review := true;
      update public.orders
         set stripe_payment_intent_id = v_payment_reference
       where id = v_order.id;

      insert into public.order_events (order_id, from_status, to_status, source, reason)
      values (v_order.id, v_order.status, v_order.status, 'stripe', 'payment_received_after_stock_release');
    end if;

    insert into public.payments (
      order_id,
      provider,
      provider_reference,
      amount_cents,
      currency,
      status,
      captured_at
    ) values (
      v_order.id,
      'stripe',
      v_payment_reference,
      p_amount_total,
      lower(v_order.currency),
      'succeeded',
      now()
    ) on conflict (provider, provider_reference) do nothing;
  elsif p_type = 'checkout.session.expired' then
    v_released := public.release_order_stock(v_order.id, 'stripe_session_expired');
  elsif p_type = 'checkout.session.async_payment_failed' then
    v_released := public.release_order_stock(v_order.id, 'stripe_payment_failed');
  end if;

  update public.stripe_events
     set processed_at = now()
   where event_id = p_event_id;

  return jsonb_build_object(
    'duplicate', false,
    'orderId', v_order.id,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'paid', v_paid,
    'released', v_released,
    'manualReview', v_manual_review
  );
end;
$$;

create or replace function public.process_stripe_charge_event(
  p_event_id text,
  p_type text,
  p_payment_intent_id text,
  p_amount_cents bigint,
  p_currency text,
  p_payload jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_inserted integer;
  v_fully_refunded boolean := false;
begin
  if nullif(btrim(p_event_id), '') is null
    or nullif(btrim(p_payment_intent_id), '') is null
    or p_amount_cents is null or p_amount_cents < 0 then
    raise exception using errcode = '22023', message = 'INVALID_STRIPE_EVENT';
  end if;

  insert into public.stripe_events (event_id, type, payload)
  values (p_event_id, p_type, p_payload)
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;
  if v_inserted = 0 then
    return jsonb_build_object('duplicate', true, 'eventId', p_event_id);
  end if;

  select * into v_order
    from public.orders
   where stripe_payment_intent_id = btrim(p_payment_intent_id)
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  if lower(coalesce(p_currency, '')) <> lower(v_order.currency) then
    raise exception using errcode = '22023', message = 'STRIPE_AMOUNT_MISMATCH';
  end if;

  if p_amount_cents > v_order.total_cents then
    raise exception using errcode = '22023', message = 'STRIPE_AMOUNT_MISMATCH';
  end if;

  if p_type = 'charge.refunded' then
    v_fully_refunded := p_amount_cents >= v_order.total_cents;
    update public.orders
       set payment_status = case when v_fully_refunded then 'refunded' else 'partially_refunded' end,
           status = case
             when v_fully_refunded and v_order.status <> 'cancelled' then 'refunded'::public.order_status
             else status
           end,
           refunded_at = case when v_fully_refunded then coalesce(refunded_at, now()) else refunded_at end
     where id = v_order.id;

    insert into public.order_events (order_id, from_status, to_status, source, reason)
    values (
      v_order.id,
      v_order.status,
      case when v_fully_refunded and v_order.status <> 'cancelled' then 'refunded'::public.order_status else v_order.status end,
      'stripe',
      case when v_fully_refunded then 'charge_refunded' else 'charge_partially_refunded' end
    );

    insert into public.payments (
      order_id, provider, provider_reference, amount_cents, currency, status, refunded_at
    ) values (
      v_order.id,
      'stripe',
      'refund:' || btrim(p_payment_intent_id) || ':' || p_amount_cents::text,
      -p_amount_cents,
      lower(v_order.currency),
      'refunded',
      now()
    ) on conflict (provider, provider_reference) do nothing;
  elsif p_type = 'charge.dispute.created' then
    update public.orders
       set payment_status = 'disputed'
     where id = v_order.id
       and payment_status <> 'disputed';

    if v_order.payment_status <> 'disputed' then
      insert into public.order_events (order_id, from_status, to_status, source, reason)
      values (v_order.id, v_order.status, v_order.status, 'stripe', 'charge_disputed');
    end if;
  end if;

  update public.stripe_events
     set processed_at = now()
   where event_id = p_event_id;

  return jsonb_build_object(
    'duplicate', false,
    'orderId', v_order.id,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'paymentStatus', case when p_type = 'charge.refunded' then 'refunded' when p_type = 'charge.dispute.created' then 'disputed' else v_order.payment_status end,
    'fullyRefunded', v_fully_refunded
  );
end;
$$;

create or replace function public.transition_order_status(
  p_order_id uuid,
  p_next_status text,
  p_tracking_number text default null,
  p_shipping_method text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_next public.order_status;
  v_allowed boolean := false;
  v_released boolean := false;
begin
  if not public.is_current_admin() then
    raise exception using errcode = '42501', message = 'ADMIN_REQUIRED';
  end if;

  select * into v_order
    from public.orders
   where id = p_order_id
   for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ORDER_NOT_FOUND';
  end if;

  v_next := p_next_status::public.order_status;

  if v_order.status::text = p_next_status then
    return jsonb_build_object('orderId', v_order.id, 'status', v_order.status);
  end if;

  v_allowed :=
    (v_order.status = 'pending' and v_next in ('cancelled'))
    or (v_order.status = 'cod_pending' and v_next in ('paid', 'processing', 'cancelled'))
    or (v_order.status = 'paid' and v_next in ('processing', 'cancelled', 'refunded'))
    or (v_order.status = 'processing' and v_next in ('shipped', 'fulfilled', 'cancelled', 'refunded'))
    or (v_order.status = 'fulfilled' and v_next in ('shipped', 'delivered', 'cancelled', 'refunded'))
    or (v_order.status = 'shipped' and v_next in ('delivered', 'returned', 'refunded'))
    or (v_order.status = 'delivered' and v_next in ('returned', 'refunded'))
    or (v_order.status = 'returned' and v_next in ('refunded'))
    or (v_order.status = 'refunded' and v_next = 'returned');

  if not v_allowed then
    raise exception using errcode = '22023', message = 'INVALID_STATUS_TRANSITION';
  end if;

  if v_next = 'cancelled' and v_order.status in ('pending', 'cod_pending', 'paid', 'processing') then
    v_released := public.release_order_stock(v_order.id, 'admin_cancelled', true);
    return jsonb_build_object('orderId', v_order.id, 'status', 'cancelled', 'released', v_released);
  end if;

  if v_next = 'refunded' and v_order.status in ('paid', 'processing', 'fulfilled', 'shipped', 'delivered') then
    v_released := public.release_order_stock(v_order.id, 'admin_refund', true);
  end if;

  update public.orders
     set status = v_next,
         payment_status = case
           when v_next = 'paid' and payment_method = 'cod' then 'paid'
           when v_next = 'refunded' then 'refunded'
           else payment_status
         end,
         paid_at = case when v_next = 'paid' then coalesce(paid_at, now()) else paid_at end,
         tracking_number = coalesce(nullif(btrim(p_tracking_number), ''), tracking_number),
         shipping_method = coalesce(nullif(btrim(p_shipping_method), ''), shipping_method),
         fulfilled_at = case when v_next in ('fulfilled', 'shipped') then coalesce(fulfilled_at, now()) else fulfilled_at end
   where id = v_order.id;

  insert into public.order_events (order_id, from_status, to_status, actor_id, source, reason)
  values (v_order.id, v_order.status, v_next, auth.uid(), 'admin', 'status_changed');

  return jsonb_build_object('orderId', v_order.id, 'status', v_next);
end;
$$;

create table if not exists public.checkout_rate_limits (
  key text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0
);

-- Rate-limit state is server-only. Without RLS plus a revoke, the public anon key
-- shipped in the storefront could read, zero, or delete these rows and reset the
-- per-IP/per-email checkout limits that check_checkout_rate_limit() enforces.
alter table public.checkout_rate_limits enable row level security;
revoke all on table public.checkout_rate_limits from anon, authenticated;

alter table public.store_settings
  add constraint store_settings_money_values check (
    key not in ('shipping_fee_cents', 'free_shipping_threshold_cents', 'gift_packaging_cents')
    or (
      jsonb_typeof(value) = 'number'
      and (value #>> '{}') ~ '^\d{1,9}$'
      and (value #>> '{}')::numeric <= 100000000
    )
  ) not valid;

create or replace function public.check_checkout_rate_limit(
  p_key text,
  p_limit integer default 6,
  p_window interval default interval '10 minutes'
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  if p_key is null or btrim(p_key) = '' or p_limit < 1 or p_window <= interval '0 seconds' then
    return false;
  end if;

  insert into public.checkout_rate_limits as rl (key, window_started_at, attempts)
  values (btrim(p_key), now(), 1)
  on conflict (key) do update
    set attempts = case
          when rl.window_started_at < now() - p_window then 1
          else rl.attempts + 1
        end,
        window_started_at = case
          when rl.window_started_at < now() - p_window then now()
          else rl.window_started_at
        end
  returning attempts <= p_limit into v_allowed;

  delete from public.checkout_rate_limits
   where window_started_at < now() - interval '2 days';

  return v_allowed;
end;
$$;

create or replace function public.release_expired_cod_orders(
  p_max_age interval default interval '48 hours'
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id uuid;
  v_released integer := 0;
begin
  for v_order_id in
    select id
      from public.orders
     where status = 'cod_pending'
       and payment_method = 'cod'
       and created_at < now() - p_max_age
     order by created_at
     limit 200
     for update skip locked
  loop
    if public.release_order_stock(v_order_id, 'cod_expired') then
      v_released := v_released + 1;
    end if;
  end loop;

  return v_released;
end;
$$;

revoke all on function public.create_order_atomic(jsonb, jsonb, text, uuid, text) from public, anon, authenticated;

revoke all on function public.release_order_stock(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.process_stripe_event(text, text, text, uuid, bigint, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.process_stripe_charge_event(text, text, text, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.transition_order_status(uuid, text, text, text) from public, anon, authenticated;

grant execute on function public.create_order_atomic(jsonb, jsonb, text, uuid, text) to service_role;
grant execute on function public.release_order_stock(uuid, text, boolean) to service_role;
grant execute on function public.process_stripe_charge_event(text, text, text, bigint, text, jsonb) to service_role;
grant execute on function public.process_stripe_event(text, text, text, uuid, bigint, text, text, text, jsonb) to service_role;
grant execute on function public.transition_order_status(uuid, text, text, text) to authenticated;
revoke all on function public.check_checkout_rate_limit(text, integer, interval) from public, anon, authenticated;
grant execute on function public.check_checkout_rate_limit(text, integer, interval) to service_role;
revoke all on function public.release_expired_cod_orders(interval) from public, anon, authenticated;
grant execute on function public.release_expired_cod_orders(interval) to service_role;
