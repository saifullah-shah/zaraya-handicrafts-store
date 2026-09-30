-- CMS schema: content sections, store settings, admin roles, storage bucket + RLS.

-- Admin roles (user_id references supabase auth.users)
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Security definer check so the client API can verify the current user is an admin
-- without exposing the admins table. Runs as table owner (bypasses RLS).
create or replace function public.is_current_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Homepage content sections managed from the CMS.
create table public.content_sections (
  id text primary key,
  page text not null default 'home',
  key text not null default 'section',
  eyebrow text not null default '',
  title text not null default '',
  subtitle text not null default '',
  body text not null default '',
  button_label text not null default '',
  button_url text not null default '',
  image_url text not null default '',
  sort integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (page, key, sort)
);

-- Key/value store settings (currency, shipping, announcements, branding).
create table public.store_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Seed default store settings (matches pricing logic in the storefront).
-- value is jsonb, so text values must be JSON strings and money must be JSON numbers.
insert into public.store_settings (key, value) values
  ('site_name', '"Zaraya Handicrafts"'),
  ('currency', '"usd"'),
  ('announcement', '"Free shipping on orders over $200"'),
  ('shipping_fee_cents', '1800'),
  ('free_shipping_threshold_cents', '20000'),
  ('gift_packaging_cents', '1200'),
  ('support_email', '"hello@zaraya.store"'),
  ('support_phone', '"+92 300 0000000"')
on conflict (key) do nothing;

-- Seed homepage content matching the storefront today (editable from the CMS).
insert into public.content_sections (id, page, key, eyebrow, title, subtitle, body, button_label, button_url, image_url, sort) values
  ('home.hero', 'home', 'hero', 'Handmade in small batches',
   'Jewelry designed to feel personal, slow, and beautifully yours.',
   'Zaraya Handicrafts reimagines everyday elegance with handcrafted bracelets made to be gifted, layered, and treasured.',
   '4.9/5 reviews
Worldwide shipping
Gift-ready packaging',
   'Shop the bracelet', '/product/zaraya-gold-arc-bracelet',
   'https://images.unsplash.com/photo-1617038220319-276d3cfab638?auto=format&fit=crop&w=1200&q=80', 10),
  ('home.announcement', 'home', 'announcement', '', 'Free shipping on orders over $200', '', '', '', '', '', 5),
  ('home.collection.heading', 'home', 'collection-heading', 'The collection', 'Fine details, lasting presence.', '', '', '', '', '', 20),
  ('home.benefits.heading', 'home', 'benefits-heading', 'Why Zaraya', 'Crafted for meaningful everyday moments.', '', '', '', '', '', 30),
  ('home.benefit.1', 'home', 'benefit', '', 'Hand-finished', 'Small-batch craftsmanship with an artisan finish and intentional details.', '', '', '', '', 31),
  ('home.benefit.2', 'home', 'benefit', '', 'Gift-ready', 'Every order ships in premium packaging designed to feel special from the moment it arrives.', '', '', '', '', 32),
  ('home.benefit.3', 'home', 'benefit', '', 'Made to last', 'Thoughtful materials, sturdy finishing, and timeless silhouettes built for everyday wear.', '', '', '', '', 33),
  ('home.story', 'home', 'story', 'Our story', 'Luxury, but personal.',
   'We create bracelets that balance modern elegance with the warmth of handmade craft. Each design is rooted in the idea that small, meaningful details become the pieces we reach for every day.

From gifting to everyday wear, Zaraya celebrates rituals that feel thoughtful, intimate, and enduring.',
   '', '', '', 'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?auto=format&fit=crop&w=1200&q=80', 40),
  ('home.reviews.heading', 'home', 'reviews-heading', 'Loved by customers', 'Quiet confidence, real joy.', '', '', '', '', '', 50),
  ('home.review.1', 'home', 'review', '', 'Ayesha M.',
   'The packaging was beautiful, and the bracelet feels incredibly premium. It looks even better in person.', '', '', '', '', 51),
  ('home.review.2', 'home', 'review', '', 'Hamza S.',
   'A perfect gift. The quality is exceptional and the finish feels refined without being overdone.', '', '', '', '', 52),
  ('home.review.3', 'home', 'review', '', 'Sara K.',
   'Elegant, minimal, and exactly what I was looking for. Every time I wear it I get compliments.', '', '', '', '', 53),
  ('home.faq.heading', 'home', 'faq-heading', 'FAQ', 'Questions, answered simply.', '', '', '', '', '', 60),
  ('home.faq.1', 'home', 'faq', 'Do you ship worldwide?',
   'Yes. We ship internationally with tracked delivery and transparent shipping timelines.', '', '', '', '', '', 61),
  ('home.faq.2', 'home', 'faq', 'Is the bracelet adjustable?',
   'Each bracelet is designed with a comfortable fit and available in multiple sizes for a tailored feel.', '', '', '', '', '', 62),
  ('home.faq.3', 'home', 'faq', 'Do you offer gift packaging?',
   'Yes, every order can be presented in premium gift-ready packaging at checkout.', '', '', '', '', '', 63),
  ('home.cta', 'home', 'cta', 'Ready to wear it', 'Make your everyday ritual feel special.', '', '',
   'Shop now', '/product/zaraya-gold-arc-bracelet', '', 70)
on conflict (id) do nothing;

-- RLS on CMS tables.
alter table public.admins enable row level security;

-- admins is only ever read through the security definer is_current_admin() helper,
-- so drop the default PostgREST grants on it outright.
revoke all on table public.admins from anon, authenticated;
alter table public.content_sections enable row level security;
alter table public.store_settings enable row level security;

create policy "Content sections are publicly readable"
  on public.content_sections for select using (true);

create policy "Admins can edit content sections"
  on public.content_sections for all
  using (public.is_current_admin())
  with check (public.is_current_admin());

create policy "Store settings are publicly readable"
  on public.store_settings for select using (true);

create policy "Admins can edit store settings"
  on public.store_settings for all
  using (public.is_current_admin())
  with check (public.is_current_admin());

-- Products: admins get full write access (public read already exists).
create policy "Admins can insert products"
  on public.products for insert
  with check (public.is_current_admin());

create policy "Admins can update products"
  on public.products for update
  using (public.is_current_admin())
  with check (public.is_current_admin());

create policy "Admins can delete products"
  on public.products for delete
  using (public.is_current_admin());

-- Orders: admins can read every order and update them (fulfillment).
create policy "Admins can read all orders"
  on public.orders for select
  using (public.is_current_admin());

create policy "Admins can update orders"
  on public.orders for update
  using (public.is_current_admin())
  with check (public.is_current_admin());

create policy "Admins can read all order items"
  on public.order_items for select
  using (public.is_current_admin());

-- Storage bucket for CMS image uploads (public read, admin write).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cms-images',
  'cms-images',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do nothing;

create policy "Public read cms-images objects"
  on storage.objects for select
  using (bucket_id = 'cms-images');

create policy "Admins can upload cms-images objects"
  on storage.objects for insert
  with check (bucket_id = 'cms-images' and public.is_current_admin());

create policy "Admins can update cms-images objects"
  on storage.objects for update
  using (bucket_id = 'cms-images' and public.is_current_admin());

create policy "Admins can delete cms-images objects"
  on storage.objects for delete
  using (bucket_id = 'cms-images' and public.is_current_admin());