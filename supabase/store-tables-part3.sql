-- =====================================================================
-- AutoFly Stores part 3 — run AFTER supabase/store-tables-part2.sql.
-- Safe to re-run (idempotent).
--
-- 1. Providers gain two order-mode flags (set per store, read by the
--    cart): holdorder (default false — the cart shows a gray
--    "Hold Order/Pay at <store> Store" button only when true) and
--    payorder (default true — the blue "Place <store> order" button
--    shows only when true). Seed values, by store name so ids can't
--    be mixed up: Paris holds only, New York pays only, Casablanca
--    does both.
-- 2. Orders gain is_hold (default false). A cart hold places a real
--    order row with is_hold = true (stock is still subtracted, the
--    owner still gets the receipt email) — it is a reservation, not
--    a payment: payment_status stays 'unpaid' and the customer pays
--    at the store when arranging delivery/pickup.
-- 3. place_store_hold_order: same validation, DB-price totals and
--    stock subtraction as place_store_order, but refuses stores whose
--    holdorder flag is off. place_store_order likewise now refuses
--    stores whose payorder flag is off, so hiding a button can never
--    be bypassed by calling the function directly.
-- =====================================================================

alter table store_providers add column if not exists holdorder boolean not null default false;
alter table store_providers add column if not exists payorder boolean not null default true;

update store_providers set holdorder = true, payorder = false where name = 'Paris Fresh Market';
update store_providers set holdorder = false, payorder = true where name = 'New York Grocery Hub';
update store_providers set holdorder = true, payorder = true where name = 'Casablanca Daily Market';

alter table store_orders add column if not exists is_hold boolean not null default false;

-- Pay orders now respect the store's payorder flag.
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

-- Hold a whole cart section: same checks as an order, but the row is
-- marked is_hold and no payment is expected (payment_status 'unpaid').
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
    v_lines := v_lines || jsonb_build_object(
      'id', v_row.id, 'name', v_row.name, 'price', v_row.price, 'qty', v_qty,
      'delivery_address', v_row.delivery_address, 'pickup_address', v_row.pickup_address);
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
