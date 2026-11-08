# Dealer — one page for every dealership

A shared car dealership page: every dealership gets its own link
(`autofly.us.com/dealer?d=<slug>`) and its own vehicles and bookings,
but they all use this same page. There is no `data.json` here — the
dealership, its vehicles, and its bookings live in the database.

## What it does

- **Vehicles** — the public inventory: every vehicle with its price
  (with thousands separators, like $16,500), mileage, fuel,
  transmission, body style, condition, drivetrain, doors, colours,
  stock number, and description.
- **Test Drive** — book a test drive: pick a vehicle, name, phone,
  email (optional), date (today by default), and time. You get a
  confirmation ("✓ Booked — test drive #<id>: …") and a copy is
  emailed to AutoFly.
- **Sell Your Car** — ask for a valuation: your car's make, model,
  year, mileage, and condition (Excellent / Good / Fair), plus your
  name, phone, email (optional), and a message. You get a
  confirmation with the trade-in number, and a copy is emailed to
  AutoFly. This is a valuation request, not a purchase offer.
- **Finance** — a payment estimator. Pick a vehicle (its price fills
  in) or type a price, enter a down payment, annual interest rate,
  and term in months, and it shows the monthly payment, total paid,
  and total interest. Estimate only — no credit check happens here
  and no financing is arranged online. Nothing is stored and nothing
  is emailed.
- **Bookings** — every test drive and trade-in request for this
  dealership, newest first, with full details and a [Mark done] and
  [Cancel] button per row. Cancelling asks in the page itself ("Cancel
  this booking?" — [Yes, cancel] [Keep it]); no browser popup is used.
  The list refreshes on its own every few seconds while open.
- **Setup** — the owner's page. Edit the dealership details (name,
  address, phone, hours, about) as a draft and upload it for AutoFly's
  approval; manage vehicles live (add, edit, delete — vehicles go live
  right away, no approval needed).

## Passwords

Two passwords, like the diner, barbershop, and POS pages. The **owner
login** (username + password, set by the admin) opens Setup. One
shared **employee password** opens Bookings; dealerships with none set
stay fully open. Both live in memory only — a reload asks again.

## Database

Everything goes through the database — nothing is kept in the
browser:

- `get_dealer_live` — the dealership and its vehicles for visitors
- `dealer_pass_status` / `check_dealer_employee_pass` — the shared
  employee password gate
- `place_dealer_testdrive` / `place_dealer_tradein` — new bookings
- `list_dealer_bookings` / `update_dealer_booking` — the staff
  booking list (mark done / cancel)
- `check_dealer_login` / `get_dealer_draft` / `save_dealer_draft` /
  `submit_dealer_draft` — the owner Setup flow
- `save_dealer_vehicle` / `delete_dealer_vehicle` — the live vehicle
  list in Setup

Booking emails go through AutoFly's `send-notification` function
(subjects "Dealer test drive: …", "Dealer trade-in: …", and "Dealer
draft for approval: …").

## Honest limits

- No payment is taken here and no financing is arranged online.
  Finance is an estimate only.
- A trade-in request is a valuation request, not a purchase offer.

## Files

- `index.html` — page shell + address bootstrap
- `app.js` — all behavior
- `style.css` — all styling
- `README.md` — this file

## Origin

Built fresh in AutoFly's dynamic pattern (same as diner, barbershop,
and POS) from the feature model of the static dealer template that
used to live in this folder (vehicles, finance estimator, test drive,
sell your car, setup). No outside code was copied, and the original
template was written for this project.
