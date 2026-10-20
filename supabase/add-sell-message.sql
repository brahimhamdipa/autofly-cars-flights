-- Optional one-time migration: store the Sell a Car "Message" field in the
-- database too. (Submissions and emails already include the message without
-- this — the site falls back gracefully. Run once in the Supabase SQL editor.)
-- Safe to run more than once.
alter table car_sell_requests add column if not exists message text;
