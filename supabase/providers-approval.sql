-- =====================================================================
-- AutoFly provider approval — run AFTER supabase/providers-form.sql.
-- Safe to re-run (idempotent).
--
-- Provider-submitted items now wait for the owner's approval: the
-- submit RPC inserts them hidden (is_active = false) and flagged
-- pending_approval = true, so no public listing or detail page shows
-- them. The owner approves in Admin → Stores → Manage → Items
-- (Approve button on pending rows), which flips both flags.
-- Admin-hidden items (pending_approval = false) are unaffected, and
-- admin-created items keep pending_approval = false.
-- =====================================================================

alter table store_items add column if not exists pending_approval boolean not null default false;

create or replace function submit_provider_item(
  p_slug text,
  p_username text,
  p_password text,
  p_category_id bigint,
  p_name text,
  p_price numeric,
  p_description text,
  p_delivery_address text,
  p_pickup_address text,
  p_delivery boolean,
  p_pickup boolean,
  p_online boolean,
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
begin
  select pf.provider_id into v_provider_id
    from "providersForm" pf
    where pf.f = p_slug and pf.u = p_username and pf.p = p_password;
  if not found then
    raise exception 'Invalid form login';
  end if;
  if p_category_id is null or not exists (select 1 from store_categories where id = p_category_id) then
    raise exception 'Unknown category';
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
    (provider_id, category_id, name, price, description, delivery_address, pickup_address,
     delivery, pickup, online, stock, pics, is_active, pending_approval)
  values
    (v_provider_id, p_category_id, btrim(p_name), p_price, coalesce(p_description, ''),
     coalesce(p_delivery_address, ''), coalesce(p_pickup_address, ''),
     coalesce(p_delivery, true), coalesce(p_pickup, true), coalesce(p_online, false),
     p_stock, coalesce(p_pics, '{}'), false, true)
  returning id into v_item_id;
  return jsonb_build_object('item_id', v_item_id);
end;
$$;
grant execute on function submit_provider_item(text, text, text, bigint, text, numeric, text, text, text, boolean, boolean, boolean, integer, text[]) to anon;
