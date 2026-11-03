# Dealer template

A self-contained car dealership page: browse vehicles, estimate
financing, book a test drive, or ask for a valuation on your own car.
Copy this whole folder under a new name and the copy just works at its
new address — the page works out its own address from the URL, so no
folder name is written in the code.

## What it does

- **Vehicles** — the inventory. Search by text, filter by make, open a
  vehicle for its full spec sheet (body style, drivetrain, transmission,
  mileage, colors, doors, fuel, condition, stock number), then book a
  test drive or jump to financing for that vehicle.
- **Finance** — a payment estimator. Pick a vehicle (its price fills
  in), enter a down payment, annual interest rate, and term in months,
  and it shows the monthly payment, number of payments, total of
  payments, and total interest. Estimate only — no credit check happens
  here and no financing is arranged online.
- **Test Drive** — book a test drive: vehicle, name, phone, email
  (optional), date, time, note. You get a receipt (reference like
  `TD-123456`) and a copy is emailed to the dealership; your bookings
  are listed below the form with Mark done / Cancel.
- **Sell Your Car** — ask for a valuation: your car's year, make,
  model, mileage, condition, and asking price (optional), plus your
  name and phone. You get a receipt (reference like `TR-123456`) and a
  copy is emailed to the dealership. This is a valuation request, not
  a purchase offer.
- **Setup** — edit the dealership and the vehicles (year, make, model,
  specs, price, stock number, description), then press “Download
  data.json”. To put changes live, replace the folder's `data.json`
  with the downloaded file. Nothing on Setup changes the live page by
  itself, on purpose, so visitors cannot change your inventory.

## Setup sign-in

Setup opens freely until the admin sets a username + password for this
folder in Admin → Folder Passes. After that, Setup asks for that pass
and unlocks for the browser session only. The password itself is never
sent to the page: the database only answers yes or no.

## Honest limits

- Test drives and trade-in requests live in the visitor's browser
  only, so a booking on one phone does not show on another. A shared,
  cross-device book would need a database table behind this page.
- No payment or financing is processed online. The Finance tab only
  estimates a monthly payment.
- There are no photos in this version: vehicle cards show specs, not
  pictures. Add a photo field in Setup's data if pictures are needed.

## Files

- `index.html` — page shell + address bootstrap
- `app.js` — all behavior
- `style.css` — all styling
- `data.json` — all content (business + vehicles)
- `README.md` — this file

## Origin

Built fresh in AutoFly's template pattern from the feature model of a
commercial car-dealership web product (vehicle inventory with search
and filters, vehicle detail specs, financing calculator, test-drive
and trade-in requests, and an admin panel). The uploaded file contained
only marketing screenshots and a sales note — no source code — and
nothing was copied from it: no text, no images, no listings, no code.
The original is a commercial, server-backed product that cannot run on
static website hosting as-is; this page is a new implementation of the
dealership idea for the web.
