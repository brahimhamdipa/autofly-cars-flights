-- One-time migration: store the adults/children breakdown on flight bookings.
-- Run in Supabase SQL Editor. Safe to run more than once.
-- The site already works without this (bookings save, breakdown is emailed);
-- this only makes the breakdown visible in the database too.
alter table flight_bookings add column if not exists adults int;
alter table flight_bookings add column if not exists children int default 0;
alter table flight_bookings add column if not exists children_ages text;
