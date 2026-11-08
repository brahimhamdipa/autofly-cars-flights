# Barbershop — template folder

A self-contained barbershop page, in the same pattern as the `dine`
restaurant page and the `houses` real-estate page. One folder = one shop
website. Copy this whole folder under a new name and the new address
works by itself: the page works out its own address from the URL, and
nothing in the code names the folder.

## Files

- `index.html` — page shell + the address bootstrap (no folder name
  hardcoded; the only `barbershop` fallback is for the bare root path).
- `app.js` — Services / Book / Bookings / Setup logic.
- `style.css` — styling.
- `data.json` — ALL content: shop details + services. Edit this file
  (or use the Setup tab) to change the shop.
- `README.md` — this file.

## Tabs

- **Services** — the shop's services with prices and durations, each
  with a "Book this" button.
- **Book** — booking form (service, name, phone, email optional, date,
  time, note). Booking reserves the chair and shows an on-screen
  receipt. **Pay at the shop — no payment is taken online.**
- **Bookings** — bookings made on *this device* (stored in the
  browser, one key per folder). Mark done, or cancel. A booking made
  on another phone does not appear here.
- **Setup** — the owner's editor: shop details + services, then
  "Download data.json". Nothing on this tab changes the live page by
  itself: replace this folder's `data.json` with the downloaded file
  and reload.

## Booking emails

A booking is emailed through AutoFly's notification service to the
shop email in Setup. When that email is empty, the copy goes to
AutoFly's inbox instead. The email is a courtesy copy — the booking
itself is saved in the browser either way, and the receipt on screen
is the confirmation.

## Copying this folder

1. Copy the whole folder, paste it under a new name (lowercase
   letters, digits, and dashes only; never `admin`).
2. After the site rebuilds (a few minutes), the copy opens at
   `yently.com/<new name>`.
3. Change the displayed shop name in the copy's Setup tab (the name
   comes from that folder's `data.json`, not from the folder name),
   download the new `data.json`, and swap it into the copied folder.

## What this is — and is not

This page was built fresh for the web, inspired by the feature model
of a 2013 Java desktop barbershop payment kiosk (service menu,
enter-an-amount, payment records, admin panel). No code, text, or
images were copied from that program: it cannot run on a website
(it needs a cash bill validator, a receipt printer, and a computer
to run on). On the web there is no cash payment and no printed
receipt — bookings reserve the chair and pay at the shop.

## Admin + passes

Any folder holding a `data.json` file appears automatically in the
AutoFly Admin folder manager (copy / rename / delete) and in the
folder pass form, so copied shops get the same admin treatment as
the restaurant and houses pages.
