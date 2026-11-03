# CarRentalSystem template

A self-contained hourly car rental page: pick a car, drive, and
pay when you bring it back. Copy this whole folder under a new
name and the copy just works at its new address — the page works
out its own address from the URL, so no folder name is written in
the code.

## What it does

- **Cars** — the fleet, listed by plate number: search, see each
  car's hourly rate and whether it is available. A car with an
  active rental shows as rented out.
- **Rent** — renting starts right now: pick an available car,
  enter name and phone, and tap Rent. The clock runs from that
  moment, and a copy is emailed to the business (receipt
  reference like `CR-123456`).
- **Returns** — cars that are out now, each with a "Return & bill"
  button. The bill is counted by the whole hour: the first 24
  hours at the car's hourly rate, extra hours at double the rate,
  plus a $50 fine when the car comes back damaged (tick the box
  before confirming). Confirming marks the car available again,
  saves the bill under Past returns, and emails a copy to the
  business.
- **Setup** — edit the business and the fleet (car name, plate
  number, hourly rate, description), then press “Download
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
- No payment is taken online: the bill is paid when the car comes
  back.
- Starting a rental and returning a car are both emailed to the
  business email in Setup (or to AutoFly's inbox when that is
  empty).

## Files

- `index.html` — page shell + address bootstrap
- `app.js` — all behavior
- `style.css` — all styling
- `data.json` — all content (business + fleet)
- `README.md` — this file

## Origin

Built fresh in AutoFly's template pattern from the feature model of
a small C++ console car rental program (users, cars by plate
number, rent and return, hourly billing with late and damage
charges). No code, text, or files were copied from it, and the
original cannot run on static website hosting as-is — this page
is a new implementation of the rental idea for the web. Two
adaptations, stated honestly: the original charged one flat hourly
rate, while this page lets each car carry its own hourly rate
(late hours are still double the car's rate, damage still a flat
fine); and the original priced in Ringgit, while this page prices
in dollars like the rest of the site.
