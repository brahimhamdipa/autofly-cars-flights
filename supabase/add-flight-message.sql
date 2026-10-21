-- Optional one-time migration: store the Flight Estimation "Message" field
-- in the database too. (Submissions and emails already include the message
-- without this — the site falls back gracefully. Run once in the Supabase
-- SQL editor.) Safe to run more than once.
alter table flight_bookings add column if not exists message text;
