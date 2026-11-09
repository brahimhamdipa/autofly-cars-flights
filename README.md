# Yently — Everything you need, gently in one place

Yently (yently.com) is a React website for small businesses and their
customers: business systems, a shop, cars, flights, kids' learning, and
custom coding services. It officially opens in early 2027.

## What the site has

- **Business Systems** — one shared system for restaurants, POS (point of
  sale), barbers, car dealers, employee time tracking, and bodyshops. Each
  business gets its own page (its link arrives by email), with an owner
  login, one shared employee password, and admin approval before it goes
  live. Add-ons: TV Gallery, Live Chat, and Clean Link (a short
  yently.com/[name] link for a shop).
- **Shop** — grocery-style store with products, stores, barcode search and
  phone camera scan, and a variant picker (flavor, color, size, pack,
  weight). Delivery is matched by city and ZIP, otherwise pickup is
  suggested.
- **Cars** — cars for sale, listed from the database. Sellers add theirs
  through a seller form with a username and password from the admin, and
  the admin approves each listing before it shows. Buyers can view the
  full details and send an inquiry. Also "Sell a Car" (instant-offer
  request) and test-drive inquiries.
- **Flights** — one way / round trip / multi-city reservation forms.
- **Yently Kids** — learning pages for 9 subjects (Math, English, Arabic,
  French, Spanish, Science, Geography, Coding, Reading), plus Books for
  Kids (coming soon).
- **Services (Custom Coding)** — request a website or a whole system for a
  small or medium business; **About Us**.
- **Live chat** — visitor chat with the Yently team (currently off).

## How it works (tech)

- **Frontend:** React + Vite (single-page app), hosted on Vercel. Pushing
  to `main` on GitHub auto-deploys to yently.com within minutes.
- **Database:** Supabase (Postgres). Listings, shops, orders, passes, and
  form submissions live there — the pages read from it, so there are no
  per-shop or per-car files in the repo.
- **Email:** every form submission is saved to Supabase, then the
  `send-notification` Edge Function emails brahimhamdipa@gmail.com
  through Resend.
- **Storage:** pictures live in the Supabase `product-images` bucket
  (shrunk in the browser before upload). The seed car photos live in
  `public/car-photos/`.
- **Admin:** sign in at yently.com/admin (owner email only). Five menus:
  Shop, Cars, Flights, Business Systems, Chat — including All Passes, the
  one place for every login handed out.

## Prices

Listed prices only — Restaurant $40/month, POS $50/month, Barber
$15/month, Dealer / Employee / Bodyshop $20/month, Sample Website
$10/month, TV Gallery $2/month, Live Chat $3/month, Clean Link $2/month,
Yently Kids $10/subject/month (first month free on most plans, with
bundle discounts from 2 plans). No payments are taken yet: carts record
orders as expressions of interest until the 2027 launch.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`
3. In the Supabase SQL Editor, run `supabase/schema.sql`
4. Deploy the email function:
   ```
   supabase functions deploy send-notification
   supabase secrets set RESEND_API_KEY=<your-key>
   ```
   Get a free key at https://resend.com
5. `npm run dev`

## Build

`npm run build`
