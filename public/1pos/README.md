# POS template

A self-contained point of sale page: ring up items, take payment, and
keep receipts. Copy this whole folder under a new name and the copy
just works at its new address — the page works out its own address
from the URL, so no folder name is written in the code.

## What it does

- **Sale** — the register. Search items, filter by category, tap Add to
  ring items up. The cart shows quantities with − / + / remove, and the
  totals show subtotal, discount, tax, and total. Enter an optional
  customer name and discount %, then tap Cash or Card to complete.
- **Receipts** — every sale made on this device, newest first, with its
  reference (like `PS-123456`), items, totals, and payment method.
  Voiding a sale marks it voided and puts its items back in stock.
- **Setup** — edit the business, the tax rate, and the items (name,
  category, price, stock — empty stock means unlimited), then press
  “Download data.json”. To put changes live, replace the folder's
  `data.json` with the downloaded file. Nothing on Setup changes the
  live page by itself, on purpose, so visitors cannot change your
  items.

## Stock

Stock shown on an item is its stock in `data.json` minus what this
device has sold (voided sales do not count). When the remaining stock
hits zero, the item cannot be added until the owner raises the stock
in Setup. Stock is tracked per device: a sale on another phone does
not change the stock shown here.

## Setup sign-in

Setup opens freely until the admin sets a username + password for this
folder in Admin → Folder Passes. After that, Setup asks for that pass
and unlocks for the browser session only. The password itself is never
sent to the page: the database only answers yes or no.

## Honest limits

- No card is charged online. "Card" only records that the card was
  taken at the counter terminal, the same way "Cash" records cash.
- Sales live in the visitor's browser only, so a sale on one phone
  does not show on another, and stock is per device as described
  above. A shared, cross-device register would need a database table
  behind this page.
- A completed sale is emailed to the business email in Setup (or to
  AutoFly's inbox when that is empty).

## Files

- `index.html` — page shell + address bootstrap
- `app.js` — all behavior
- `style.css` — all styling
- `data.json` — all content (business + tax rate + items)
- `README.md` — this file

## Origin

Built fresh in AutoFly's template pattern from the feature model of
Open Source Point of Sale (a PHP + MySQL web app: sale register,
stock management, taxation, receipts, customers, reporting, and
more). No code, text, or files were copied from it, and the original
cannot run on static website hosting as-is — this page is a new
implementation of the register idea for the web.
