-- =====================================================================
-- AutoFly Stores on tables — replaces the folder-driven Stores system.
-- Tables: store_categories, store_providers, store_items, store_orders,
-- store_holds. Run once in the Supabase SQL editor (safe to re-run:
-- everything below is idempotent).
--
-- Name mapping (the site's spec used these names; the tables use the
-- shorter equivalents on the right):
--   Provider  -> store_providers   (provider_ID, provider_Name, ...)
--   Items     -> store_items       (item_ID, item_Name, item_Price,
--                item_DeliveryAddress -> delivery_address,
--                item_ShippingAddress -> pickup_address,
--                item_BooleanDelivery -> delivery,
--                item_BooleanPickup   -> pickup,
--                item_BooleanItem     -> is_active,
--                item_Pics -> pics (text array, 1 or more pictures),
--                item_CategoryID -> category_id, item_ProviderID -> provider_id)
--   Category  -> store_categories  (one ROW per category instead of one
--                column per category, so "filter by category" is a query:
--                where category_id = <id>)
-- Relations: a provider has zero or many items; every item has exactly
-- one provider and exactly one category.
-- =====================================================================

create table if not exists store_categories (
  id bigint generated always as identity primary key,
  name text not null,
  slug text not null,
  created_at timestamptz default now()
);
create unique index if not exists store_categories_slug_key on store_categories (slug);
create unique index if not exists store_categories_name_key on store_categories (name);

create table if not exists store_providers (
  id bigint generated always as identity primary key,
  name text not null,
  phone text default '',
  email text default '',
  address text default '',
  city text default '',
  country text default '',
  zip text default '',
  hours text default '',
  about text default '',
  pics text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists store_providers_name_key on store_providers (name);

create table if not exists store_items (
  id bigint generated always as identity primary key,
  provider_id bigint not null references store_providers (id) on delete restrict,
  category_id bigint not null references store_categories (id) on delete restrict,
  name text not null,
  price numeric(10,2) not null,
  description text default '',
  delivery_address text default '',
  pickup_address text default '',
  delivery boolean not null default true,
  pickup boolean not null default true,
  is_active boolean not null default true,
  pics text[] not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists store_items_name_key on store_items (name);
create index if not exists store_items_provider_idx on store_items (provider_id);
create index if not exists store_items_category_idx on store_items (category_id);

create table if not exists store_orders (
  id bigint generated always as identity primary key,
  provider_id bigint not null references store_providers (id) on delete restrict,
  customer_name text not null,
  customer_email text not null,
  customer_phone text default '',
  fulfillment text not null default 'delivery',
  delivery_address text default '',
  items jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null default 0,
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  created_at timestamptz default now()
);

create table if not exists store_holds (
  id bigint generated always as identity primary key,
  item_id bigint not null references store_items (id) on delete restrict,
  provider_id bigint not null references store_providers (id) on delete restrict,
  customer_name text not null,
  customer_email text not null,
  customer_phone text default '',
  status text not null default 'held',
  created_at timestamptz default now()
);

alter table store_categories enable row level security;
alter table store_providers enable row level security;
alter table store_items enable row level security;
alter table store_orders enable row level security;
alter table store_holds enable row level security;

-- Public storefront: anyone can read categories, providers and items.
-- No direct anon writes anywhere: orders and holds go through the RPCs.
drop policy if exists "public read store categories" on store_categories;
create policy "public read store categories" on store_categories
  for select to anon using (true);
drop policy if exists "public read store providers" on store_providers;
create policy "public read store providers" on store_providers
  for select to anon using (true);
drop policy if exists "public read store items" on store_items;
create policy "public read store items" on store_items
  for select to anon using (true);

-- Admin (owner's email only) has full access to all five tables.
drop policy if exists "admin all store categories" on store_categories;
create policy "admin all store categories" on store_categories
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');
drop policy if exists "admin all store providers" on store_providers;
create policy "admin all store providers" on store_providers
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');
drop policy if exists "admin all store items" on store_items;
create policy "admin all store items" on store_items
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');
drop policy if exists "admin all store orders" on store_orders;
create policy "admin all store orders" on store_orders
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');
drop policy if exists "admin all store holds" on store_holds;
create policy "admin all store holds" on store_holds
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

-- Place a store order: validates the items belong to this provider and
-- are active, checks delivery/pickup support, computes the total from DB
-- prices (never trusts the browser's total), and inserts the order.
create or replace function place_store_order(
  p_provider_id bigint,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_fulfillment text,
  p_delivery_address text,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_row store_items%rowtype;
  v_qty int;
  v_total numeric(10,2) := 0;
  v_lines jsonb := '[]'::jsonb;
  v_order_id bigint;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;
  if p_fulfillment not in ('delivery', 'pickup') then
    raise exception 'Bad fulfillment';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 then raise exception 'Bad quantity'; end if;
    select * into v_row from store_items
      where id = (v_item->>'id')::bigint;
    if not found then raise exception 'Item % not found', v_item->>'id'; end if;
    if v_row.provider_id <> p_provider_id then
      raise exception '% does not belong to this store', v_row.name;
    end if;
    if not v_row.is_active then raise exception '% is not available', v_row.name; end if;
    if p_fulfillment = 'delivery' and not v_row.delivery then
      raise exception '% cannot be delivered', v_row.name;
    end if;
    if p_fulfillment = 'pickup' and not v_row.pickup then
      raise exception '% cannot be picked up', v_row.name;
    end if;
    v_total := v_total + (v_row.price * v_qty);
    v_lines := v_lines || jsonb_build_object(
      'id', v_row.id, 'name', v_row.name, 'price', v_row.price, 'qty', v_qty,
      'delivery_address', v_row.delivery_address, 'pickup_address', v_row.pickup_address);
  end loop;
  insert into store_orders
    (provider_id, customer_name, customer_email, customer_phone, fulfillment, delivery_address, items, total)
  values
    (p_provider_id, p_customer_name, p_customer_email, p_customer_phone, p_fulfillment,
     coalesce(p_delivery_address, ''), v_lines, v_total)
  returning id into v_order_id;
  return jsonb_build_object('order_id', v_order_id, 'total', v_total, 'items', v_lines);
end;
$$;
grant execute on function place_store_order(bigint, text, text, text, text, text, jsonb) to anon;

-- Hold one item: reserves it with the store (no online payment is taken;
-- the customer pays the store when they arrange pickup/delivery).
create or replace function place_store_hold(
  p_item_id bigint,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row store_items%rowtype;
  v_hold_id bigint;
begin
  select * into v_row from store_items where id = p_item_id;
  if not found then raise exception 'Item not found'; end if;
  if not v_row.is_active then raise exception '% is not available', v_row.name; end if;
  insert into store_holds (item_id, provider_id, customer_name, customer_email, customer_phone)
  values (p_item_id, v_row.provider_id, p_customer_name, p_customer_email, coalesce(p_customer_phone, ''))
  returning id into v_hold_id;
  return jsonb_build_object('hold_id', v_hold_id, 'item', v_row.name, 'price', v_row.price);
end;
$$;
grant execute on function place_store_hold(bigint, text, text, text) to anon;

-- =============================== Seed data ===============================
insert into store_categories (name, slug) values
  ('Store products', 'store-products'),
  ('Snacks & Lunches', 'snacks-lunches'),
  ('Meats', 'meats'),
  ('Machinery', 'machinery'),
  ('Services', 'services'),
  ('Clothes', 'clothes'),
  ('Other', 'other')
on conflict (slug) do nothing;

insert into store_providers
  (name, phone, email, address, city, country, zip, hours, about, pics) values
  ('Paris Fresh Market', '+33 1 42 60 00 01', 'paris@autofly.us.com', '12 Rue de la Paix', 'Paris', 'France', '75002',
   'Monday - Saturday, 8:00 AM - 8:00 PM',
   'A friendly neighborhood market in the heart of Paris. Fresh bread every morning, local cheeses, fruits, vegetables and everyday groceries, with staff who speak French and English.',
   array['https://picsum.photos/seed/autofly-paris-1/800/600', 'https://picsum.photos/seed/autofly-paris-2/800/600', 'https://picsum.photos/seed/autofly-paris-3/800/600']),
  ('New York Grocery Hub', '+1 212-555-0148', 'newyork@autofly.us.com', '250 Broadway', 'New York', 'USA', '10007',
   'Every day, 7:00 AM - 10:00 PM',
   'A big, bright grocery store in Lower Manhattan. Wide aisles, fresh produce, a bakery and a deli counter, plus same-day pickup for orders placed through AutoFly.',
   array['https://picsum.photos/seed/autofly-newyork-1/800/600', 'https://picsum.photos/seed/autofly-newyork-2/800/600', 'https://picsum.photos/seed/autofly-newyork-3/800/600']),
  ('Casablanca Daily Market', '+212 5 22 39 00 12', 'casablanca@autofly.us.com', '45 Boulevard Anfa', 'Casablanca', 'Morocco', '20100',
   'Monday - Saturday, 8:30 AM - 9:00 PM',
   'A warm local market on Boulevard Anfa. Fresh fish, spices, bread and Moroccan pantry staples, with delivery across Casablanca and staff who speak Arabic, French and English.',
   array['https://picsum.photos/seed/autofly-casablanca-1/800/600', 'https://picsum.photos/seed/autofly-casablanca-2/800/600', 'https://picsum.photos/seed/autofly-casablanca-3/800/600'])
on conflict (name) do nothing;

-- Store products (the "Order from us" shelf of each store).
insert into store_items
  (provider_id, category_id, name, price, description, delivery_address, pickup_address, delivery, pickup, is_active, pics) values
  ((select id from store_providers where name = 'Paris Fresh Market'), (select id from store_categories where slug = 'store-products'),
   'French Bread Basket', 8.50, 'Fresh baguettes and croissants, baked this morning.', 'Delivered from: 12 Rue de la Paix, Paris', '12 Rue de la Paix, Paris', true, true, true,
   array['https://picsum.photos/seed/autofly-paris-bread-1/800/600', 'https://picsum.photos/seed/autofly-paris-bread-2/800/600', 'https://picsum.photos/seed/autofly-paris-bread-3/800/600']),
  ((select id from store_providers where name = 'Paris Fresh Market'), (select id from store_categories where slug = 'store-products'),
   'Cheese Selection Board', 24.00, 'Five local cheeses with grapes and crackers.', 'Delivered from: 12 Rue de la Paix, Paris', '12 Rue de la Paix, Paris', true, true, true,
   array['https://picsum.photos/seed/autofly-paris-cheese-1/800/600', 'https://picsum.photos/seed/autofly-paris-cheese-2/800/600']),
  ((select id from store_providers where name = 'Paris Fresh Market'), (select id from store_categories where slug = 'store-products'),
   'Seasonal Fruit Box', 19.99, 'A box of the week''s best market fruit. Pickup only — too delicate to deliver.', '', '12 Rue de la Paix, Paris', false, true, true,
   array['https://picsum.photos/seed/autofly-paris-fruit-1/800/600', 'https://picsum.photos/seed/autofly-paris-fruit-2/800/600', 'https://picsum.photos/seed/autofly-paris-fruit-3/800/600']),
  ((select id from store_providers where name = 'New York Grocery Hub'), (select id from store_categories where slug = 'store-products'),
   'Deli Sandwich Pack', 14.50, 'Four deli sandwiches, made fresh at the counter.', 'Delivered from: 250 Broadway, New York', '250 Broadway, New York', true, true, true,
   array['https://picsum.photos/seed/autofly-ny-deli-1/800/600', 'https://picsum.photos/seed/autofly-ny-deli-2/800/600']),
  ((select id from store_providers where name = 'New York Grocery Hub'), (select id from store_categories where slug = 'store-products'),
   'Coffee Beans 1 lb', 16.00, 'Freshly roasted beans, ground on request. Delivery only.', 'Delivered from: 250 Broadway, New York', '', true, false, true,
   array['https://picsum.photos/seed/autofly-ny-coffee-1/800/600', 'https://picsum.photos/seed/autofly-ny-coffee-2/800/600', 'https://picsum.photos/seed/autofly-ny-coffee-3/800/600']),
  ((select id from store_providers where name = 'New York Grocery Hub'), (select id from store_categories where slug = 'store-products'),
   'Bagels Dozen', 7.99, 'Twelve fresh bagels, plain or everything.', 'Delivered from: 250 Broadway, New York', '250 Broadway, New York', true, true, true,
   array['https://picsum.photos/seed/autofly-ny-bagels-1/800/600', 'https://picsum.photos/seed/autofly-ny-bagels-2/800/600']),
  ((select id from store_providers where name = 'Casablanca Daily Market'), (select id from store_categories where slug = 'store-products'),
   'Argan Oil 250 ml', 18.00, 'Pure Moroccan argan oil, cold pressed.', 'Delivered from: 45 Boulevard Anfa, Casablanca', '45 Boulevard Anfa, Casablanca', true, true, true,
   array['https://picsum.photos/seed/autofly-casa-argan-1/800/600', 'https://picsum.photos/seed/autofly-casa-argan-2/800/600', 'https://picsum.photos/seed/autofly-casa-argan-3/800/600']),
  ((select id from store_providers where name = 'Casablanca Daily Market'), (select id from store_categories where slug = 'store-products'),
   'Moroccan Spice Set', 12.50, 'Ras el hanout, cumin, paprika and saffron.', 'Delivered from: 45 Boulevard Anfa, Casablanca', '45 Boulevard Anfa, Casablanca', true, true, true,
   array['https://picsum.photos/seed/autofly-casa-spice-1/800/600', 'https://picsum.photos/seed/autofly-casa-spice-2/800/600']),
  ((select id from store_providers where name = 'Casablanca Daily Market'), (select id from store_categories where slug = 'store-products'),
   'Fresh Fish Box', 29.99, 'The morning catch, cleaned and packed on ice.', 'Delivered from: 45 Boulevard Anfa, Casablanca', '45 Boulevard Anfa, Casablanca', true, true, true,
   array['https://picsum.photos/seed/autofly-casa-fish-1/800/600', 'https://picsum.photos/seed/autofly-casa-fish-2/800/600', 'https://picsum.photos/seed/autofly-casa-fish-3/800/600']),
  ((select id from store_providers where name = 'Casablanca Daily Market'), (select id from store_categories where slug = 'store-products'),
   'Old Stock Dates', 5.00, 'Example of a hidden item — it never shows on the site.', '', '45 Boulevard Anfa, Casablanca', true, true, false,
   array['https://picsum.photos/seed/autofly-casa-dates-1/800/600'])
on conflict (name) do nothing;

-- Items in the other categories (these fill the submenu category pages).
insert into store_items
  (provider_id, category_id, name, price, description, delivery_address, pickup_address, delivery, pickup, is_active, pics) values
  ((select id from store_providers where name = 'New York Grocery Hub'), (select id from store_categories where slug = 'snacks-lunches'),
   'Lunch Sandwich Box', 11.00, 'Sandwich, chips and a drink — ready to grab.', 'Delivered from: 250 Broadway, New York', '250 Broadway, New York', true, true, true,
   array['https://picsum.photos/seed/autofly-ny-lunch-1/800/600', 'https://picsum.photos/seed/autofly-ny-lunch-2/800/600']),
  ((select id from store_providers where name = 'Paris Fresh Market'), (select id from store_categories where slug = 'snacks-lunches'),
   'Croissant Pack', 6.50, 'Six butter croissants, baked this morning.', 'Delivered from: 12 Rue de la Paix, Paris', '12 Rue de la Paix, Paris', true, true, true,
   array['https://picsum.photos/seed/autofly-paris-croissant-1/800/600', 'https://picsum.photos/seed/autofly-paris-croissant-2/800/600']),
  ((select id from store_providers where name = 'Casablanca Daily Market'), (select id from store_categories where slug = 'meats'),
   'Lamb Chops 1 kg', 22.00, 'Fresh lamb chops, cut to order.', 'Delivered from: 45 Boulevard Anfa, Casablanca', '45 Boulevard Anfa, Casablanca', true, true, true,
   array['https://picsum.photos/seed/autofly-casa-lamb-1/800/600', 'https://picsum.photos/seed/autofly-casa-lamb-2/800/600']),
  ((select id from store_providers where name = 'New York Grocery Hub'), (select id from store_categories where slug = 'meats'),
   'Beef Steak Pack', 26.50, 'Two ribeye steaks, well marbled.', 'Delivered from: 250 Broadway, New York', '250 Broadway, New York', true, true, true,
   array['https://picsum.photos/seed/autofly-ny-steak-1/800/600', 'https://picsum.photos/seed/autofly-ny-steak-2/800/600']),
  ((select id from store_providers where name = 'New York Grocery Hub'), (select id from store_categories where slug = 'clothes'),
   'AutoFly T-Shirt', 19.99, 'Soft cotton tee with the AutoFly logo.', 'Delivered from: 250 Broadway, New York', '250 Broadway, New York', true, true, true,
   array['https://picsum.photos/seed/autofly-ny-tee-1/800/600', 'https://picsum.photos/seed/autofly-ny-tee-2/800/600']),
  ((select id from store_providers where name = 'Casablanca Daily Market'), (select id from store_categories where slug = 'clothes'),
   'Cotton Tote Bag', 9.99, 'Sturdy market tote, natural cotton.', 'Delivered from: 45 Boulevard Anfa, Casablanca', '45 Boulevard Anfa, Casablanca', true, true, true,
   array['https://picsum.photos/seed/autofly-casa-tote-1/800/600', 'https://picsum.photos/seed/autofly-casa-tote-2/800/600']),
  ((select id from store_providers where name = 'New York Grocery Hub'), (select id from store_categories where slug = 'machinery'),
   'Hand Drill Set', 49.99, 'Cordless drill with bits and charger.', 'Delivered from: 250 Broadway, New York', '250 Broadway, New York', true, true, true,
   array['https://picsum.photos/seed/autofly-ny-drill-1/800/600', 'https://picsum.photos/seed/autofly-ny-drill-2/800/600']),
  ((select id from store_providers where name = 'Paris Fresh Market'), (select id from store_categories where slug = 'services'),
   'Home Cleaning Hour', 25.00, 'One hour of home cleaning by the store''s team.', '', '12 Rue de la Paix, Paris', false, true, true,
   array['https://picsum.photos/seed/autofly-paris-clean-1/800/600', 'https://picsum.photos/seed/autofly-paris-clean-2/800/600']),
  ((select id from store_providers where name = 'Casablanca Daily Market'), (select id from store_categories where slug = 'other'),
   'Gift Basket', 34.99, 'A basket of the market''s best — ready to give.', 'Delivered from: 45 Boulevard Anfa, Casablanca', '45 Boulevard Anfa, Casablanca', true, true, true,
   array['https://picsum.photos/seed/autofly-casa-gift-1/800/600', 'https://picsum.photos/seed/autofly-casa-gift-2/800/600'])
on conflict (name) do nothing;
