-- AutoFly Supabase schema
-- Run this in Supabase SQL Editor

-- Car sell requests (Sell your car form)
create table if not exists car_sell_requests (
  id bigint generated always as identity primary key,
  make text not null,
  model text not null,
  year int not null,
  mileage int not null,
  condition text default 'Good',
  vin text,
  name text not null,
  email text not null,
  phone text,
  message text,
  created_at timestamptz default now()
);

-- Car inquiries (I'm interested / Get instant offer / Send inquiry)
-- Folder-driven Cars section stores the car folder name in car_name;
-- car_id is legacy and nullable.
create table if not exists car_inquiries (
  id bigint generated always as identity primary key,
  car_id int,
  car_name text,
  name text not null,
  email text not null,
  phone text,
  message text,
  created_at timestamptz default now()
);

-- Flight bookings
create table if not exists flight_bookings (
  id bigint generated always as identity primary key,
  trip_type text not null default 'Round Trip',
  from_city text not null,
  to_city text not null,
  depart_date date not null,
  return_date date,
  travelers int not null default 1,
  adults int,
  children int default 0,
  children_ages text,
  cabin_class text not null default 'Economy',
  direct_only boolean default false,
  name text not null,
  email text not null,
  phone text,
  created_at timestamptz default now()
);

-- Enable RLS and allow public inserts (simple public site)
alter table car_sell_requests enable row level security;
alter table car_inquiries enable row level security;
alter table flight_bookings enable row level security;

drop policy if exists "public insert sell" on car_sell_requests;
create policy "public insert sell" on car_sell_requests for insert to anon with check (true);

drop policy if exists "public insert inquiry" on car_inquiries;
create policy "public insert inquiry" on car_inquiries for insert to anon with check (true);

drop policy if exists "public insert flight" on flight_bookings;
create policy "public insert flight" on flight_bookings for insert to anon with check (true);

-- Optional: allow service_role to read all (for admin dashboard)
