# RentCarAdmin template

A self-contained admin panel for a car rental business: a rides
dashboard, a cars table, and a drivers table. Copy this whole
folder under a new name and the copy just works at its new
address — the page works out its own address from the URL, so no
folder name is written in the code.

## What it does

- **Dashboard** — the rides table: ride date, car number, driver
  name, ride timing, total hours, extra hours, status, and start
  and end odometer readings. Search by car number or driver,
  filter by status, change a ride's status in place, delete a
  ride, and add a new ride from the form below the table.
- **Cars** — the fleet table: car number, insurance reference,
  PUC reference, RC book reference, and company name, with
  add, edit, and delete.
- **Drivers** — the drivers table: name, phone, email, date of
  birth, licence number, address, and a photo note, with add,
  edit, and delete.
- **Setup** — edit the business, then press “Download data.json”.
  To put changes live, replace the folder's `data.json` with the
  downloaded file. Nothing on Setup changes the live page by
  itself, on purpose.

## Sign-in

This page is an admin tool, so the folder pass guards the whole
page, not just Setup. Setup opens freely until the admin sets a
username + password for this folder in Admin → Folder Passes.
After that, the page asks for that pass and unlocks for the
browser session only. The password itself is never sent to the
page: the database only answers yes or no.

## Honest limits

- Rides, cars, and drivers edited on their tabs are saved in
  this browser only. A change made on one phone does not show on
  another until the owner exports it from Setup and replaces the
  folder's `data.json`. A shared, cross-device panel would need
  a database table behind this page.
- Document fields (insurance, PUC, RC book, driver photo) are
  text references here. The original showed uploaded document
  photos; this static page has no file uploads.

## Files

- `index.html` — page shell + address bootstrap
- `app.js` — all behavior
- `style.css` — all styling
- `data.json` — all content (business + rides + cars + drivers)
- `README.md` — this file

## Origin

Built fresh in AutoFly's template pattern from the feature model
of a React admin panel for car rentals (dashboard rides table,
cars table, drivers table, and email sign-in). No code, text,
images, or files were copied from it, and its sign-in cannot run
here as-is: it was wired to the original author's Firebase
project, whose keys are not reused. This page is a new
implementation of the admin-panel idea for the web, using
AutoFly's own folder-pass sign-in instead of Firebase.
