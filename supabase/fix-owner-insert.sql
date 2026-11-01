-- =====================================================================
-- Fix: form submissions failed with an RLS violation when the OWNER was
-- logged in to Admin in the same browser.
--
-- Root cause: the public insert policies on the three form tables are
-- "for insert to anon" ONLY, and the admin policies are read + delete
-- ONLY — so a logged-in admin (role "authenticated", not "anon") had NO
-- insert policy at all and every form failed, while anonymous visitors
-- (the normal case) worked fine. That is why the failure appeared on
-- Services, Cars and Flights Estimation at the same time.
--
-- Fix: add insert policies for the owner's account only. Nobody else
-- gains anything: anonymous visitors keep using the public policies,
-- other logged-in users still cannot insert.
-- Safe to re-run (policies are dropped/recreated).
-- =====================================================================

drop policy if exists "owner insert sell" on car_sell_requests;
create policy "owner insert sell" on car_sell_requests
  for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "owner insert inquiry" on car_inquiries;
create policy "owner insert inquiry" on car_inquiries
  for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

drop policy if exists "owner insert flight" on flight_bookings;
create policy "owner insert flight" on flight_bookings
  for insert to authenticated
  with check ((auth.jwt() ->> 'email') = 'brahimhamdipa@gmail.com');

-- Bonus (same visit, also idempotent): the optional flight/sell columns
-- that were never added, so bookings store the breakdown + message
-- instead of relying on the site's fallback path.
alter table flight_bookings add column if not exists adults int;
alter table flight_bookings add column if not exists children int default 0;
alter table flight_bookings add column if not exists children_ages text;
alter table flight_bookings add column if not exists message text;
alter table car_sell_requests add column if not exists message text;
