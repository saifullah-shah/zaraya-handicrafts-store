create type public.order_status as enum ('pending', 'paid', 'cod_pending', 'fulfilled', 'cancelled');
create type public.payment_method as enum ('stripe', 'cod');

create table public.products (
  id text primary key,
  slug text unique not null,
  name text not null,
  price integer not null check (price >= 0),
  compare_at_price integer,
  rating numeric(2, 1) default 0,
  reviews integer default 0,
  badge text default '',
  category text default '',
  materials text[] default '{}',
  description text default '',
  long_description text default '',
  images text[] default '{}',
  colors text[] default '{}',
  sizes text[] default '{}',
  stock integer default 0,
  gift_packaging boolean default true,
  details text[] default '{}',
  featured boolean default false,
  created_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null,
  user_id uuid references auth.users (id) on delete set null,
  email text,
  status public.order_status not null default 'pending',
  payment_method public.payment_method not null default 'stripe',
  currency text not null default 'usd',
  subtotal_cents integer not null default 0,
  gift_packaging_cents integer not null default 0,
  shipping_cents integer not null default 0,
  total_cents integer not null default 0,
  shipping_address jsonb not null default '{}'::jsonb,
  stripe_session_id text,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id text references public.products (id) on delete restrict,
  product_name text not null,
  quantity integer not null check (quantity > 0),
  color text not null default '',
  size text not null default '',
  gift_packaging boolean not null default false,
  unit_price_cents integer not null default 0
);

create index orders_user_id_idx on public.orders (user_id);
create index orders_email_idx on public.orders (email);
create index orders_stripe_session_idx on public.orders (stripe_session_id);
create index order_items_order_id_idx on public.order_items (order_id);

create or replace function public.decrement_stock(p_id text, p_quantity integer)
returns void
language sql
security definer
set search_path = public
as $$
  update public.products
  set stock = greatest(stock - p_quantity, 0)
  where id = p_id;
$$;

insert into public.products (id, slug, name, price, compare_at_price, rating, reviews, badge, category, materials, description, long_description, images, colors, sizes, stock, gift_packaging, details, featured) values
  ('zaraya-gold-arc', 'zaraya-gold-arc-bracelet', 'Zaraya Gold Arc Bracelet', 148, 188, 4.9, 236, 'Best Seller', 'Handmade Jewelry',
   array['18k gold vermeil', 'Brass core', 'Hand-finished polish'],
   'An heirloom-inspired bracelet designed for everyday rituals and elevated gifting.',
   'The Gold Arc Bracelet is sculpted to feel light, refined, and unforgettable. Each piece is handmade in small quantities to preserve natural character and premium finish quality.',
   array['https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1200&q=80'],
   array['Champagne Gold', 'Antique Silver', 'Rose Gold'], array['S', 'M', 'L'], 24, true,
   array['Handmade in limited batches', 'Adjustable fit for everyday wear', 'Comes gift-ready in a premium box', 'Designed for layering or solo wear'],
   true),
  ('zaraya-rose-veil', 'zaraya-rose-veil-bracelet', 'Zaraya Rose Veil Bracelet', 162, 199, 4.8, 184, 'New Arrival', 'Fine Craft',
   array['Rose gold finish', 'Brushed brass', 'Soft satin pouch'],
   'Soft curves and warm tones create a bracelet that feels as personal as it looks.',
   'Crafted with a softly brushed finish and warm rose undertones, the Rose Veil Bracelet blends modern minimalism with artisanal charm for gifting and self-expression.',
   array['https://images.unsplash.com/photo-1602173574767-37ac01994b2a?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&w=1200&q=80'],
   array['Rose Gold', 'Champagne Gold'], array['S', 'M', 'L'], 18, true,
   array['Warm rose tones with polished finish', 'Designed for gifting and travel', 'Brushed texture adds artisanal depth', 'Includes protective packaging'],
   false),
  ('zaraya-silkline', 'zaraya-silkline-bracelet', 'Zaraya Silkline Bracelet', 136, 175, 4.7, 152, 'Signature', 'Minimal Luxe',
   array['Sterling silver tone', 'Soft woven texture', 'Hand stitched detail'],
   'A muted, modern bracelet with soft texture and a polished, sculptural silhouette.',
   'The Silkline Bracelet balances a refined silhouette with tactile craftsmanship. Its understated finish makes it ideal for layering or as a thoughtful everyday signature piece.',
   array['https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=1200&q=80', 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=1200&q=80'],
   array['Silver', 'Ivory', 'Stone'], array['S', 'M', 'L'], 31, true,
   array['Minimal silhouette with subtle texture', 'Weighted enough to feel premium', 'Made for all-day wear', 'Includes artisan care card'],
   false)
on conflict (id) do nothing;

alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "Products are publicly readable"
  on public.products for select using (true);

create policy "Users can read their own orders"
  on public.orders for select
  using (auth.uid() = user_id or email = auth.jwt() ->> 'email');

create policy "Users can read their own order items"
  on public.order_items for select
  using (
    order_id in (
      select id from public.orders
      where auth.uid() = user_id or email = auth.jwt() ->> 'email'
    )
  );