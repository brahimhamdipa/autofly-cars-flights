-- =====================================================================
-- AutoFly provider forms — run AFTER supabase/store-tables-part3.sql.
-- Safe to re-run (idempotent).
--
-- providersForm: one temporary login form per store provider (one to
-- one — a provider can have at most one form, enforced by the unique
-- provider_id). The admin creates the form (provider, form name,
-- username, password, note) and shares autofly.us.com/<f> with the
-- store owner, who logs in with u/p and submits items straight into
-- store_items, one per submit. Deleting the form only removes the
-- login — items already submitted stay.
--
-- SECURITY NOTE: u/p are throwaway credentials the owner invents for
-- a store (never his own passwords). The table has NO anonymous
-- access at all: the public form page reaches it only through the two
-- RPCs below, so a visitor can never list usernames or passwords.
-- =====================================================================

create table if not exists "providersForm" (
  id bigint generated always as identity primary key,
  provider_id bigint not null references store_providers (id) on delete cascade,
  f text not null,
  u text not null,
  p text not null,
  comment text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create unique index if not exists "providersForm_provider_key" on "providersForm" (provider_id);
create unique index if not exists "providersForm_f_key" on "providersForm" (f);

alter table "providersForm" enable row level security;
drop policy if exists "owner all" on "providersForm";
create policy "owner all" on "providersForm" for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

-- Public login check: returns the provider only when slug + username
-- + password all match; otherwise ok=false (no row is ever exposed).
create or replace function check_provider_form(p_slug text, p_username text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row record;
begin
  select pf.provider_id, sp.name into v_row
    from "providersForm" pf
    join store_providers sp on sp.id = pf.provider_id
    where pf.f = p_slug and pf.u = p_username and pf.p = p_password;
  if not found then
    return jsonb_build_object('ok', false);
  end if;
  return jsonb_build_object('ok', true, 'provider_id', v_row.provider_id, 'provider_name', v_row.name);
end;
$$;
grant execute on function check_provider_form(text, text, text) to anon;

-- Public item submit: re-checks the login server-side on every
-- submit, then inserts ONE item for that form's provider. The caller
-- can never choose another provider, and items go live immediately.
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
     delivery, pickup, online, stock, pics, is_active)
  values
    (v_provider_id, p_category_id, btrim(p_name), p_price, coalesce(p_description, ''),
     coalesce(p_delivery_address, ''), coalesce(p_pickup_address, ''),
     coalesce(p_delivery, true), coalesce(p_pickup, true), coalesce(p_online, false),
     p_stock, coalesce(p_pics, '{}'), true)
  returning id into v_item_id;
  return jsonb_build_object('item_id', v_item_id);
end;
$$;
grant execute on function submit_provider_item(text, text, text, bigint, text, numeric, text, text, text, boolean, boolean, boolean, integer, text[]) to anon;

-- Retailer picture uploads: anonymous visitors may only ADD files
-- under store/ in the product-images bucket (they can never list or
-- overwrite other files through this policy; the site only shows
-- pictures an item row points to).
drop policy if exists "anon insert store pics" on storage.objects;
create policy "anon insert store pics" on storage.objects for insert to anon
  with check (bucket_id = 'product-images' and name like 'store/%');
