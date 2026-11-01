-- AutoFly shop redesign — run in Supabase SQL editor, AFTER nothing else.
-- 1) Replace store_categories with the category table (items now link to
--    categories ONLY through store_item_categories).
-- 2) Drop the online flag (delivery/pickup booleans + fromDel coverage
--    replace it).
-- 3) Order RPCs v4: same signatures, order lines now carry the variant
--    label when the customer picked one.
-- 4) Provider submit RPC v3: categories via junction array, no online
--    flag, approval behavior kept (items start hidden + pending).
-- 5) WIPE old shop data for a fresh start. INTENTIONAL and irreversible:
--    the user asked to delete all old shop entries ("nothing is real so
--    far"). Form submissions, chat and Cars/Flights data are NOT touched.
-- Run store-seed-examples.sql SEPARATELY after this succeeds.

-- --- 1) Drop old category link + table + online flag ---
alter table public.store_items drop column if exists category_id;
alter table public.store_items drop column if exists online;
drop table if exists public.store_categories;

-- --- 2) Order RPCs v4 (same signatures as v3; lines gain 'variant') ---
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
  v_line jsonb;
  v_order_id bigint;
  v_pay boolean;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;
  if p_fulfillment not in ('delivery', 'pickup') then
    raise exception 'Bad fulfillment';
  end if;
  select payorder into v_pay from store_providers where id = p_provider_id;
  if not found then raise exception 'Store not found'; end if;
  if not coalesce(v_pay, true) then
    raise exception 'This store does not take online orders';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 then raise exception 'Bad quantity'; end if;
    select * into v_row from store_items
      where id = (v_item->>'id')::bigint
      for update;
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
    if v_row.stock is not null then
      if v_row.stock < v_qty then
        raise exception 'Only % left of %', v_row.stock, v_row.name;
      end if;
      update store_items set stock = stock - v_qty where id = v_row.id;
    end if;
    v_total := v_total + (v_row.price * v_qty);
    v_line := jsonb_build_object(
      'id', v_row.id, 'name', v_row.name, 'price', v_row.price, 'qty', v_qty,
      'delivery_address', v_row.delivery_address, 'pickup_address', v_row.pickup_address);
    if (v_item->>'variant') is not null and btrim(v_item->>'variant') <> '' then
      v_line := v_line || jsonb_build_object('variant', v_item->>'variant');
    end if;
    v_lines := v_lines || v_line;
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

create or replace function place_store_hold_order(
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
  v_line jsonb;
  v_order_id bigint;
  v_hold boolean;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'Cart is empty';
  end if;
  if p_fulfillment not in ('delivery', 'pickup') then
    raise exception 'Bad fulfillment';
  end if;
  select holdorder into v_hold from store_providers where id = p_provider_id;
  if not found then raise exception 'Store not found'; end if;
  if not coalesce(v_hold, false) then
    raise exception 'This store does not take hold orders';
  end if;
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item->>'qty')::int;
    if v_qty is null or v_qty < 1 then raise exception 'Bad quantity'; end if;
    select * into v_row from store_items
      where id = (v_item->>'id')::bigint
      for update;
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
    if v_row.stock is not null then
      if v_row.stock < v_qty then
        raise exception 'Only % left of %', v_row.stock, v_row.name;
      end if;
      update store_items set stock = stock - v_qty where id = v_row.id;
    end if;
    v_total := v_total + (v_row.price * v_qty);
    v_line := jsonb_build_object(
      'id', v_row.id, 'name', v_row.name, 'price', v_row.price, 'qty', v_qty,
      'delivery_address', v_row.delivery_address, 'pickup_address', v_row.pickup_address);
    if (v_item->>'variant') is not null and btrim(v_item->>'variant') <> '' then
      v_line := v_line || jsonb_build_object('variant', v_item->>'variant');
    end if;
    v_lines := v_lines || v_line;
  end loop;
  insert into store_orders
    (provider_id, customer_name, customer_email, customer_phone, fulfillment, delivery_address, items, total, is_hold)
  values
    (p_provider_id, p_customer_name, p_customer_email, p_customer_phone, p_fulfillment,
     coalesce(p_delivery_address, ''), v_lines, v_total, true)
  returning id into v_order_id;
  return jsonb_build_object('order_id', v_order_id, 'total', v_total, 'items', v_lines);
end;
$$;
grant execute on function place_store_hold_order(bigint, text, text, text, text, text, jsonb) to anon;

-- --- 3) Provider submit RPC v3 (drops the old signature first, because
-- the parameter list changed: category array instead of one id, no online).
drop function if exists submit_provider_item(text, text, text, bigint, text, numeric, text, text, text, boolean, boolean, boolean, integer, text[]);
create or replace function submit_provider_item(
  p_slug text,
  p_username text,
  p_password text,
  p_category_ids bigint[],
  p_name text,
  p_price numeric,
  p_description text,
  p_delivery_address text,
  p_pickup_address text,
  p_delivery boolean,
  p_pickup boolean,
  p_stock integer,
  p_pics text[]
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_provider_id bigint;
  v_item_id bigint;
  v_cat_id bigint;
begin
  select pf.provider_id into v_provider_id
    from "providersForm" pf
    where pf.f = p_slug and pf.u = p_username and pf.p = p_password;
  if not found then
    raise exception 'Invalid form login';
  end if;
  if p_category_ids is not null then
    foreach v_cat_id in array p_category_ids loop
      if not exists (select 1 from category where id = v_cat_id) then
        raise exception 'Unknown category';
      end if;
    end loop;
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Item name is required';
  end if;
  if p_price is null or p_price < 0 then
    raise exception 'Bad price';
  end if;
  if p_stock is not null and p_stock < 0 then
    raise exception 'Bad stock';
  end if;
  insert into store_items
    (provider_id, name, price, description, delivery_address, pickup_address,
     delivery, pickup, stock, pics, is_active, pending_approval)
  values
    (v_provider_id, btrim(p_name), p_price, coalesce(p_description, ''),
     coalesce(p_delivery_address, ''), coalesce(p_pickup_address, ''),
     coalesce(p_delivery, true), coalesce(p_pickup, true),
     p_stock, coalesce(p_pics, '{}'), false, true)
  returning id into v_item_id;
  if p_category_ids is not null then
    foreach v_cat_id in array p_category_ids loop
      insert into store_item_categories (item_id, category_id)
      values (v_item_id, v_cat_id)
      on conflict do nothing;
    end loop;
  end if;
  return jsonb_build_object('item_id', v_item_id);
end;
$$;
grant execute on function submit_provider_item(text, text, text, bigint[], text, numeric, text, text, text, boolean, boolean, integer, text[]) to anon;

-- --- 4) WIPE old shop data (intentional, irreversible) ---
truncate table public.store_providers, public.store_items, public.store_orders, public.store_holds,
  public.store_item_fromdel, public.store_item_topick, public.store_item_categories,
  public."fromDel", public."toPick", public."subCategory", public."providersForm",
  public.grocery_products, public.grocery_orders
  restart identity cascade;
