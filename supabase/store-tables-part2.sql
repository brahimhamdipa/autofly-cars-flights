-- =====================================================================
-- AutoFly Stores part 2 — run AFTER supabase/store-tables.sql.
-- Safe to re-run (idempotent).
--
-- 1. Items gain: online (item_BooleanOnline, default false — true means
--    the item is sold on the Online Store page) and stock (item_Stock,
--    null = not tracked, e.g. services; otherwise the number shown in
--    green under the price, like the Online Store page).
-- 2. place_store_order / place_store_hold now check stock and subtract
--    it (orders subtract the quantity, holds subtract 1), refusing
--    oversells — the same guarantee the grocery order RPC already gives.
-- 3. Customer chat: site_settings (chat on/off switch), chat_conversations
--    and chat_messages. Customers talk through security-definer RPCs
--    (no direct table access for anonymous visitors, so one visitor can
--    never read another's chat); the admin reads/writes directly.
-- =====================================================================

alter table store_items add column if not exists online boolean not null default false;
alter table store_items add column if not exists stock integer;

-- Seed: which example items sell online, and their stock counts.
update store_items set online = true, stock = 40 where name = 'French Bread Basket';
update store_items set online = false, stock = 15 where name = 'Cheese Selection Board';
update store_items set online = false, stock = 8 where name = 'Seasonal Fruit Box';
update store_items set online = false, stock = 20 where name = 'Deli Sandwich Pack';
update store_items set online = true, stock = 25 where name = 'Coffee Beans 1 lb';
update store_items set online = false, stock = 30 where name = 'Bagels Dozen';
update store_items set online = true, stock = 12 where name = 'Argan Oil 250 ml';
update store_items set online = false, stock = 18 where name = 'Moroccan Spice Set';
update store_items set online = false, stock = 6 where name = 'Fresh Fish Box';
update store_items set online = false, stock = 0 where name = 'Old Stock Dates';
update store_items set online = false, stock = 24 where name = 'Lunch Sandwich Box';
update store_items set online = false, stock = 36 where name = 'Croissant Pack';
update store_items set online = false, stock = 10 where name = 'Lamb Chops 1 kg';
update store_items set online = false, stock = 14 where name = 'Beef Steak Pack';
update store_items set online = false, stock = 50 where name = 'AutoFly T-Shirt';
update store_items set online = false, stock = 40 where name = 'Cotton Tote Bag';
update store_items set online = false, stock = 5 where name = 'Hand Drill Set';
update store_items set online = false, stock = null where name = 'Home Cleaning Hour';
update store_items set online = false, stock = 20 where name = 'Gift Basket';

-- Place a store order (v2): same validation as before, plus stock check
-- and stock subtraction. Totals still come from database prices only.
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

-- Hold one item (v2): same as before, plus stock check and subtraction.
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
  select * into v_row from store_items where id = p_item_id for update;
  if not found then raise exception 'Item not found'; end if;
  if not v_row.is_active then raise exception '% is not available', v_row.name; end if;
  if v_row.stock is not null then
    if v_row.stock < 1 then raise exception '% is out of stock', v_row.name; end if;
    update store_items set stock = stock - 1 where id = p_item_id;
  end if;
  insert into store_holds (item_id, provider_id, customer_name, customer_email, customer_phone)
  values (p_item_id, v_row.provider_id, p_customer_name, p_customer_email, coalesce(p_customer_phone, ''))
  returning id into v_hold_id;
  return jsonb_build_object('hold_id', v_hold_id, 'item', v_row.name, 'price', v_row.price);
end;
$$;
grant execute on function place_store_hold(bigint, text, text, text) to anon;

-- =============================== Chat =================================
create table if not exists site_settings (
  key text primary key,
  value text not null
);

create table if not exists chat_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_id text not null,
  customer_name text default '',
  customer_email text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists chat_conversations_visitor_key on chat_conversations (visitor_id);

create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references chat_conversations (id) on delete cascade,
  sender text not null check (sender in ('customer', 'owner')),
  body text not null,
  read_by_owner boolean not null default false,
  created_at timestamptz default now()
);
create index if not exists chat_messages_conversation_idx on chat_messages (conversation_id, created_at);

alter table site_settings enable row level security;
alter table chat_conversations enable row level security;
alter table chat_messages enable row level security;

-- Anyone may read the settings (the chat on/off switch is not sensitive).
drop policy if exists "public read site settings" on site_settings;
create policy "public read site settings" on site_settings
  for select to anon using (true);

-- Admin (owner's email only) has full access to all three chat tables.
-- Anonymous visitors get NO direct policies: they talk via the RPCs
-- below, which check the visitor id, so chats stay private.
drop policy if exists "admin all site settings" on site_settings;
create policy "admin all site settings" on site_settings
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');
drop policy if exists "admin all chat conversations" on chat_conversations;
create policy "admin all chat conversations" on chat_conversations
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');
drop policy if exists "admin all chat messages" on chat_messages;
create policy "admin all chat messages" on chat_messages
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

-- One conversation per visitor; a returning visitor resumes their thread.
create or replace function get_or_create_conversation(
  p_visitor_id text,
  p_name text,
  p_email text
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  select id into v_id from chat_conversations where visitor_id = p_visitor_id;
  if found then
    update chat_conversations
      set customer_name = case when coalesce(p_name, '') <> '' then p_name else customer_name end,
          customer_email = case when coalesce(p_email, '') <> '' then p_email else customer_email end
      where id = v_id;
    return v_id;
  end if;
  insert into chat_conversations (visitor_id, customer_name, customer_email)
  values (p_visitor_id, coalesce(p_name, ''), coalesce(p_email, ''))
  returning id into v_id;
  return v_id;
end;
$$;
grant execute on function get_or_create_conversation(text, text, text) to anon;

-- A customer sends a message (only into their own conversation).
create or replace function send_chat_message(
  p_conversation_id uuid,
  p_visitor_id text,
  p_body text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_msg_id uuid;
  v_created timestamptz;
begin
  if coalesce(p_body, '') = '' then raise exception 'Empty message'; end if;
  perform 1 from chat_conversations where id = p_conversation_id and visitor_id = p_visitor_id;
  if not found then raise exception 'Conversation not found'; end if;
  insert into chat_messages (conversation_id, sender, body)
  values (p_conversation_id, 'customer', p_body)
  returning id, created_at into v_msg_id, v_created;
  update chat_conversations set updated_at = now() where id = p_conversation_id;
  return jsonb_build_object('id', v_msg_id, 'created_at', v_created);
end;
$$;
grant execute on function send_chat_message(uuid, text, text) to anon;

-- A customer reads their own thread (oldest first).
create or replace function get_chat_messages(
  p_conversation_id uuid,
  p_visitor_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_out jsonb;
begin
  perform 1 from chat_conversations where id = p_conversation_id and visitor_id = p_visitor_id;
  if not found then raise exception 'Conversation not found'; end if;
  select coalesce(jsonb_agg(m order by m.created_at), '[]'::jsonb) into v_out
  from (select id, sender, body, created_at from chat_messages
        where conversation_id = p_conversation_id order by created_at) m;
  return v_out;
end;
$$;
grant execute on function get_chat_messages(uuid, text) to anon;

-- Chat starts ON; the admin can switch it off from the Chat section.
insert into site_settings (key, value) values ('chat_enabled', 'true')
on conflict (key) do nothing;
