# CarRental template

A self-contained car rental page: browse the fleet, book a car by
the day, and return it. Copy this whole folder under a new name and
the copy just works at its new address — the page works out its own
address from the URL, so no folder name is written in the code.

## What it does

- **Cars** — the fleet: search, filter by type, and see each car's
  seats, transmission, daily rate, and whether it is available. A
  car with an active rental shows as rented out.
- **Rent** — book a car: pick an available car, enter name and
  phone (email optional), choose pickup and return dates, and see
  the total at once (days × daily rate). Booking saves the rental
  on this device, marks the car rented out, and emails a copy to
  the business (receipt reference like `RT-123456`).
- **My Rentals** — rentals made on this device, newest first, with
  dates, days, and total. An active rental has a "Return this car"
  button, which marks it returned and makes the car available
  again.
- **Setup** — edit the business and the cars (name, type, seats,
  transmission, price per day, description), then press “Download
  data.json”. To put changes live, replace the folder's `data.json`
  with the downloaded file. Nothing on Setup changes the live page
  by itself, on purpose, so visitors cannot change your fleet.

## Setup sign-in

Setup opens freely until the admin sets a username + password for
this folder in Admin → Folder Passes. After that, Setup asks for
that pass and unlocks for the browser session only. The password
itself is never sent to the page: the database only answers yes
or no.

## Honest limits

- Rentals live in the visitor's browser only, so a rental made on
  one phone does not show on another, and a car rented on one
  device still looks available on another. A shared, cross-device
  fleet would need a database table behind this page.
- No payment is taken online: the total is the rental price, paid
  at pickup.
- A rental is emailed to the business email in Setup (or to
  AutoFly's inbox when that is empty). Returns are local records
  and are not emailed.

## Files

- `index.html` — page shell + address bootstrap
- `app.js` — all behavior
- `style.css` — all styling
- `data.json` — all content (business + cars)
- `README.md` — this file

## Origin

Built fresh in AutoFly's template pattern from the feature model of
CRS, a VB.NET Windows desktop car rental system (vehicle and client
records, rentals, returns, bills, and quick lookup, backed by a
database). No code, text, images, or files were copied from it, and
the original cannot run on static website hosting as-is — this page
is a new implementation of the rental idea for the web.
