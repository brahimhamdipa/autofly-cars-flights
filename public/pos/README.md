# POS — one page for every store

A shared point of sale: every store gets its own private link and its
own items, sales, and stock, but they all use this same page. There
is no `data.json` here — the store, its items, and its sales live in
the database.

## What it does

- **Shop** — the public price list: every item with its price and
  stock, grouped by category.
- **Sell** — the register. Tap Add to ring items up, change
  quantities with − / +, enter an optional customer name and phone,
  pick Cash or Card, enter the cash tendered, and complete the sale.
  Tax (from the store's settings, 8% by default) is added at the
  till. The sale lowers the stock by itself, and the receipt shows
  with a Print button.
- **Receipts** — every sale for this store, newest first, with its
  reference (like `PS-42`), items, totals, and payment method.
  Voiding a sale marks it voided and puts its items back in stock.
- **Setup** — the owner's page. Edit the store details (name,
  address, phone, tax rate, receipt message) as a draft and upload
  it for AutoFly's approval; manage items live (add, edit, delete —
  items go live right away, no approval needed).

## Passwords

Two passwords, like the diner and barbershop pages. The **owner
login** (username + password, set by the admin) opens Setup. One
shared **employee password** opens the register and the receipts;
stores with none set stay fully open. Both live in memory only — a
reload asks again.

## Barcode scanning

The register can scan product barcodes with the phone's camera — no
extra hardware. Each item can carry a barcode (the number under its
printed barcode): the owner types it in Setup, or taps the scan
button there to fill it from the camera. At the till, the cashier
taps **Scan barcode** and points the phone at a product — the item
joins the sale by itself. A code with no item, or an out-of-stock
item, is reported on the spot instead of being added. The scanner
runs in the page itself (a vendored JavaScript decoder), so it works
on any phone with a camera and an internet connection.

## Stock

Stock lives in the database, not in a browser: a sale on any phone
lowers the stock for every phone, and a voided sale puts it back.
When the stock hits zero, the item cannot be added until the owner
raises it in Setup.

## Honest limits

- No card is charged online. "Card" only records that the card was
  taken at the counter terminal, the same way "Cash" records cash.
- Sales are recorded in the database and emailed to AutoFly only for
  draft approvals — there is no per-sale email to the owner.

## Files

- `index.html` — page shell + address bootstrap
- `app.js` — all behavior
- `style.css` — all styling
- `README.md` — this file

## Origin

Built fresh in AutoFly's dynamic pattern (same as diner and
barbershop) from the feature model of Open Source Point of Sale
(a PHP + MySQL web app: sale register, stock management, taxation,
receipts, customers, reporting, and more). No code, text, or files
were copied from it, and the original cannot run on static website
hosting as-is — this page is a new implementation of the register
idea for the web.
