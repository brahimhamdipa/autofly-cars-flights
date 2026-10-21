-- =====================================================================
-- AutoFly Grocery Store — products, orders, and a stock-safe order RPC.
-- Run once in the Supabase SQL editor (safe to re-run: everything is
-- idempotent). Seeding sample products is at the bottom.
-- =====================================================================

-- Products: rich fields on purpose — the future admin page (login-protected)
-- will manage all of these, including pictures and stock.
create table if not exists grocery_products (
  id bigint generated always as identity primary key,
  name text not null,
  description text default '',
  category text default 'Groceries',
  price numeric(10,2) not null,
  sale_price numeric(10,2),
  unit text default 'each',
  image_url text default '',
  images jsonb not null default '[]'::jsonb,
  stock int not null default 0,
  sku text default '',
  brand text default '',
  weight text default '',
  tags text default '',
  delivery_address text default '',
  pickup_address text default '',
  is_available boolean not null default true,
  sort_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists grocery_orders (
  id bigint generated always as identity primary key,
  customer_name text not null,
  customer_email text not null,
  customer_phone text default '',
  fulfillment text not null default 'delivery',
  delivery_address text default '',
  items jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null default 0,
  status text not null default 'pending',
  payment_status text not null default 'unpaid',
  payment_ref text default '',
  created_at timestamptz default now()
);

alter table grocery_products enable row level security;
alter table grocery_orders enable row level security;

-- Anyone can read products (the shop window). No direct anon writes to
-- products or orders: stock changes happen only inside the RPC below.
drop policy if exists "public read products" on grocery_products;
create policy "public read products" on grocery_products
  for select to anon using (true);

-- Place an order atomically: validates availability + stock, decrements
-- stock, computes the total from DB prices, and inserts the order.
create or replace function place_grocery_order(
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
  v_product grocery_products%rowtype;
  v_qty int;
  v_price numeric(10,2);
  v_total numeric(10,2) := 0;
  v_lines jsonb := '[]'::jsonb;
  v_order_id bigint;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 then raise exception 'Bad quantity'; end if;
    select * into v_product from grocery_products
      where id = (v_item->>'id')::bigint for update;
    if not found then raise exception 'Product % not found', v_item->>'id'; end if;
    if not v_product.is_available then raise exception '% is not available', v_product.name; end if;
    if v_product.stock < v_qty then
      raise exception 'Only % of % left in stock', v_product.stock, v_product.name;
    end if;
    v_price := coalesce(v_product.sale_price, v_product.price);
    update grocery_products
      set stock = stock - v_qty, updated_at = now()
      where id = v_product.id;
    v_total := v_total + (v_price * v_qty);
    v_lines := v_lines || jsonb_build_object(
      'id', v_product.id, 'name', v_product.name, 'price', v_price,
      'qty', v_qty, 'unit', v_product.unit,
      'pickup_address', v_product.pickup_address,
      'delivery_address', v_product.delivery_address);
  end loop;
  insert into grocery_orders
    (customer_name, customer_email, customer_phone, fulfillment, delivery_address, items, total)
  values
    (p_customer_name, p_customer_email, p_customer_phone, p_fulfillment,
     coalesce(p_delivery_address, ''), v_lines, v_total)
  returning id into v_order_id;
  return jsonb_build_object('order_id', v_order_id, 'total', v_total, 'items', v_lines);
end;
$$;

grant execute on function place_grocery_order(text, text, text, text, text, jsonb) to anon;

-- Product names are unique so re-running the seed below never duplicates.
create unique index if not exists grocery_products_name_key
  on grocery_products (name);

-- ============ Sample products (edit/replace later from the admin page) ==
insert into grocery_products
  (name, description, category, price, unit, stock, delivery_address, pickup_address, sort_order)
values
  ('Fresh Atlantic Salmon Fillet', 'Fresh, never frozen. Rich in omega-3 — perfect for grilling or baking.', 'Fresh Fish', 12.99, 'lb', 25,
   'Delivered from: AutoFly Market, 45 Dock St, Brooklyn, NY', 'AutoFly Market, 123 Main St, Brooklyn, NY', 1),
  ('Wild Shrimp (1 lb bag)', 'Peeled and deveined, frozen at sea for freshness.', 'Fresh Fish', 14.99, 'bag', 18,
   'Delivered from: AutoFly Market, 45 Dock St, Brooklyn, NY', 'AutoFly Market, 123 Main St, Brooklyn, NY', 2),
  ('Organic Bananas', 'Sweet and ripe, sold by the pound.', 'Produce', 0.69, 'lb', 120,
   'Delivered from: AutoFly Market, 45 Dock St, Brooklyn, NY', 'AutoFly Market, 123 Main St, Brooklyn, NY', 3),
  ('Hass Avocados (4 pack)', 'Creamy and ready in 2–3 days.', 'Produce', 5.99, 'pack', 45,
   'Delivered from: AutoFly Market, 45 Dock St, Brooklyn, NY', 'AutoFly Market, 123 Main St, Brooklyn, NY', 4),
  ('Free-Range Eggs (12 ct)', 'Farm fresh brown eggs from free-range hens.', 'Dairy & Eggs', 4.49, 'dozen', 60,
   'Delivered from: AutoFly Market, 45 Dock St, Brooklyn, NY', 'AutoFly Market, 123 Main St, Brooklyn, NY', 5),
  ('Sourdough Bread Loaf', 'Baked fresh daily, crusty and soft inside.', 'Bakery', 3.99, 'loaf', 30,
   'Delivered from: AutoFly Market, 45 Dock St, Brooklyn, NY', 'AutoFly Market, 123 Main St, Brooklyn, NY', 6)
on conflict (name) do nothing;
