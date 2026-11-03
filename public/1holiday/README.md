# Holiday template

A self-contained holiday rental page: properties, booking, bookings, and
a protected Setup tab. Copy this whole folder under a new name and the
copy just works at its new address — the page works out its own address
from the URL, so no folder name is written in the code.

## What it does

- **Properties** — cards for each rental property: location, reference,
  rooms, description, nightly rate, and peak-season nightly rate.
- **Book** — pick a property, your name and phone (required), email
  (optional), arrival date, nights, guests, and a note. The total is
  nights × the standard nightly rate. Booking shows a receipt with a
  reference like `HO-123456` and emails a copy to the business email in
  Setup (or to AutoFly's inbox when that is empty).
- **Bookings** — bookings made on this device, with Mark done / Cancel.
  A booking made on another phone does not appear here.
- **Setup** — edit the business and the properties, then press
  “Download data.json”. To put changes live, replace the folder's
  `data.json` with the downloaded file. Nothing on Setup changes the
  live page by itself, on purpose, so visitors cannot change anything.

## Setup sign-in

Setup opens freely until the admin sets a username + password for this
folder in Admin → Folder Passes. After that, Setup asks for that pass
and unlocks for the browser session only. The password itself is never
sent to the page: the database only answers yes or no.

## Honest limits

- No payment is taken online. Booking reserves the stay; the guest pays
  at the property. No bank or card details are asked for or stored.
- The standard nightly rate applies to every booking; the peak rate is
  shown on the property card for high season but is not charged by the
  page — the business confirms peak pricing with the guest.
- Bookings live in the visitor's browser only, so a booking made on one
  phone does not show on another. A shared, cross-device booking book
  would need a database table behind this page.

## Files

- `index.html` — page shell + address bootstrap
- `app.js` — all behavior
- `style.css` — all styling
- `data.json` — all content (business + properties)
- `README.md` — this file

## Origin

Built fresh in AutoFly's template pattern from the feature model of
HARM (Holiday Accommodation Rental Manager), a Perl + GTK + SQLite
desktop program for holiday rentals (owners, properties, bookings with
arrival/departure/nights/cost/deposit, seasons with per-room pricing,
and reports). No code, text, or files were copied from it, and the
original cannot run on a website as-is — this page is a new
implementation of the same idea for the web.
