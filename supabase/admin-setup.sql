-- =====================================================================
-- AutoFly Admin — access for ONE account only (the owner's email).
-- Creates: admin policies on store + submission tables, and a public
-- product-images storage bucket only the admin can write to.
-- Safe to re-run (policies are dropped/recreated, bucket uses on conflict).
-- =====================================================================

-- ---------- Grocery products: admin can do everything ----------
drop policy if exists "admin all products" on grocery_products;
create policy "admin all products" on grocery_products
  for all to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

-- ---------- Grocery orders: admin can read + update (status/payment) ----
drop policy if exists "admin read orders" on grocery_orders;
create policy "admin read orders" on grocery_orders
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');
drop policy if exists "admin update orders" on grocery_orders;
create policy "admin update orders" on grocery_orders
  for update to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

-- ---------- Form submissions: admin can read + delete -------------------
drop policy if exists "admin read car_sell_requests" on car_sell_requests;
create policy "admin read car_sell_requests" on car_sell_requests
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');
drop policy if exists "admin delete car_sell_requests" on car_sell_requests;
create policy "admin delete car_sell_requests" on car_sell_requests
  for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "admin read car_inquiries" on car_inquiries;
create policy "admin read car_inquiries" on car_inquiries
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');
drop policy if exists "admin delete car_inquiries" on car_inquiries;
create policy "admin delete car_inquiries" on car_inquiries
  for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "admin read flight_bookings" on flight_bookings;
create policy "admin read flight_bookings" on flight_bookings
  for select to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');
drop policy if exists "admin delete flight_bookings" on flight_bookings;
create policy "admin delete flight_bookings" on flight_bookings
  for delete to authenticated
  using ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

-- ---------- Product pictures storage bucket ------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "public read product images" on storage.objects;
create policy "public read product images" on storage.objects
  for select to public
  using (bucket_id = 'product-images');

drop policy if exists "admin insert product images" on storage.objects;
create policy "admin insert product images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images'
    and (auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "admin update product images" on storage.objects;
create policy "admin update product images" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images'
    and (auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com')
  with check (bucket_id = 'product-images'
    and (auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "admin delete product images" on storage.objects;
create policy "admin delete product images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images'
    and (auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');
