# AutoFly — Cars Selling + Flights Reservations

Simple React site combining ideas from Carvana (cars) and CheapFareGuru (flights).

## Features
- **Cars tab**: browse sample inventory, filter by make/price, "Sell your car" instant-offer form, "Request a car" inquiry form
- **Flights tab**: One Way / Round Trip / Multi City, From/To, dates, travelers, cabin, direct-only — simple reservation form
- **Supabase**: all submissions saved to `car_sell_requests`, `car_inquiries`, `flight_bookings`
- **Email**: every submission triggers Edge Function `send-notification` → email to `brahimhamdipa@gmail.com`

## Setup
1. `npm install`
2. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
3. In Supabase SQL Editor, run `supabase/schema.sql`
4. Deploy email function:
   ```
   supabase functions deploy send-notification
   supabase secrets set RESEND_API_KEY=re_xxx NOTIFY_TO=brahimhamdipa@gmail.com
   ```
   Get a free key at https://resend.com
5. `npm run dev`

## Build
`npm run build`
