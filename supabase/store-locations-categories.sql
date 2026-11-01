-- AutoFly: delivery locations, pickup locations, item categories, subcategories, barcode
-- Draft: run via Supabase SQL editor. Idempotent (safe to re-run).
-- Naming follows the user's spec exactly (quoted mixed-case names, like "providersForm").

-- 1) Delivery locations ("from" addresses)
create table if not exists public."fromDel" (
  id bigint generated always as identity primary key,
  fname text not null default '',
  faddress text not null default '',
  fcity text not null default '',
  fstate text not null default '',
  fzip text not null default '',
  fcountry text not null default '',
  fcounty text default '',
  ftownship text default '',
  fcomment text default '',
  created_at timestamptz not null default now()
);

-- 2) Pickup locations ("to" addresses)
-- Note: the spec listed tname twice; the second one is read as taddress
-- (the checkout popup format lists tname, taddress, tcity, tstate, tzip, tcountry).
create table if not exists public."toPick" (
  id bigint generated always as identity primary key,
  tname text not null default '',
  taddress text not null default '',
  tcity text not null default '',
  tstate text not null default '',
  tzip text not null default '',
  tcountry text not null default '',
  tcounty text default '',
  ttownship text default '',
  tcomment text default '',
  created_at timestamptz not null default now()
);

-- 3) Item categories.
-- The spec's list (general, dairy, meat, ...) is read as category NAMES, not columns:
-- one column per category cannot link items properly, which is why store_categories
-- became rows back in October. So category is one row per name, seeded below.
create table if not exists public.category (
  id bigint generated always as identity primary key,
  slug text not null unique,
  label text not null default ''
);

insert into public.category (slug, label) values
  ('general', 'General'),
  ('dairy', 'Dairy'),
  ('meat', 'Meat'),
  ('clothes', 'Clothes'),
  ('drinks', 'Drinks'),
  ('snacks', 'Snacks'),
  ('subs', 'Subs'),
  ('pizzas', 'Pizzas'),
  ('specials', 'Specials'),
  ('electronics', 'Electronics'),
  ('toys', 'Toys'),
  ('games', 'Games'),
  ('tools', 'Tools'),
  ('animals', 'Animals'),
  ('frozen', 'Frozen')
on conflict (slug) do nothing;

-- 4) Subcategories: zero to many per category (category_id FK, cascade on delete)
create table if not exists public."subCategory" (
  id bigint generated always as identity primary key,
  category_id bigint not null references public.category(id) on delete cascade,
  flavor text default '',
  color text default '',
  packof integer,
  size text default '',
  weight numeric,
  unit text default '',
  created_at timestamptz not null default now()
);

-- 5) Barcode on store_items
alter table public.store_items add column if not exists "barCode" text default '';

-- 6) Item links: zero to many, via junction rows so one location/category
-- can serve many items (this is what makes the checkout "&" rule work:
-- with several items, only locations linked to ALL of them are shown).
create table if not exists public.store_item_fromdel (
  item_id bigint not null references public.store_items(id) on delete cascade,
  fromdel_id bigint not null references public."fromDel"(id) on delete cascade,
  primary key (item_id, fromdel_id)
);
create table if not exists public.store_item_topick (
  item_id bigint not null references public.store_items(id) on delete cascade,
  topick_id bigint not null references public."toPick"(id) on delete cascade,
  primary key (item_id, topick_id)
);
create table if not exists public.store_item_categories (
  item_id bigint not null references public.store_items(id) on delete cascade,
  category_id bigint not null references public.category(id) on delete cascade,
  primary key (item_id, category_id)
);

-- 7) RLS: everyone can read (checkout popups need it); only the owner can write.
-- Follows the same pattern as the store tables.
alter table public."fromDel" enable row level security;
alter table public."toPick" enable row level security;
alter table public.category enable row level security;
alter table public."subCategory" enable row level security;
alter table public.store_item_fromdel enable row level security;
alter table public.store_item_topick enable row level security;
alter table public.store_item_categories enable row level security;

drop policy if exists "public read" on public."fromDel";
create policy "public read" on public."fromDel" for select to anon using (true);
drop policy if exists "owner all" on public."fromDel";
create policy "owner all" on public."fromDel" for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "public read" on public."toPick";
create policy "public read" on public."toPick" for select to anon using (true);
drop policy if exists "owner all" on public."toPick";
create policy "owner all" on public."toPick" for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "public read" on public.category;
create policy "public read" on public.category for select to anon using (true);
drop policy if exists "owner all" on public.category;
create policy "owner all" on public.category for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "public read" on public."subCategory";
create policy "public read" on public."subCategory" for select to anon using (true);
drop policy if exists "owner all" on public."subCategory";
create policy "owner all" on public."subCategory" for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "public read" on public.store_item_fromdel;
create policy "public read" on public.store_item_fromdel for select to anon using (true);
drop policy if exists "owner all" on public.store_item_fromdel;
create policy "owner all" on public.store_item_fromdel for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "public read" on public.store_item_topick;
create policy "public read" on public.store_item_topick for select to anon using (true);
drop policy if exists "owner all" on public.store_item_topick;
create policy "owner all" on public.store_item_topick for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "public read" on public.store_item_categories;
create policy "public read" on public.store_item_categories for select to anon using (true);
drop policy if exists "owner all" on public.store_item_categories;
create policy "owner all" on public.store_item_categories for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

grant select on public."fromDel", public."toPick", public.category, public."subCategory",
  public.store_item_fromdel, public.store_item_topick, public.store_item_categories to anon;
grant all on public."fromDel", public."toPick", public.category, public."subCategory",
  public.store_item_fromdel, public.store_item_topick, public.store_item_categories to authenticated;
grant usage, select on all sequences in schema public to authenticated;
