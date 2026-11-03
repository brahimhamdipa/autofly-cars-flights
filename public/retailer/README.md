# Retailer template

A self-contained small-shop manager: goods, sales, stock-in,
expenses, and reports. Copy this whole folder under a new name and
the copy just works at its new address — the page works out its own
address from the URL, so no folder name is written in the code.

## What it does

- **Goods** — the inventory: search, filter by brand, and see each
  good's price and live stock. Stock is Setup stock, plus shipments
  received, minus sales made on this device.
- **Sell** — the register. Search and filter goods, tap Add to ring
  them up, apply an optional discount %, and tap Sell. The sale is
  saved on this device, stock drops at once, and a copy is emailed
  to the business (receipt reference like `RS-123456`).
- **Shipments** — record goods as they arrive (good, quantity, cost
  per unit, date, note). Stock rises at once.
- **Expenses** — record day-to-day shop costs (date, what for,
  amount) with a running total.
- **Reports** — goods count, stock value at cost and at price, total
  sales, total expenses, sales minus expenses, low-stock list (5 or
  fewer), sales by day, and recent sales with a Void button (voiding
  puts the items back in stock).
- **Setup** — edit the business, brands, and goods (article code,
  name, brand, cost, price, stock), then press “Download data.json”.
  To put changes live, replace the folder's `data.json` with the
  downloaded file. Nothing on Setup changes the live page by itself,
  on purpose, so visitors cannot change your goods.

## Setup sign-in

Setup opens freely until the admin sets a username + password for
this folder in Admin → Folder Passes. After that, Setup asks for
that pass and unlocks for the browser session only. The password
itself is never sent to the page: the database only answers yes
or no.

## Honest limits

- Sales, shipments, and expenses live in the visitor's browser only,
  so a record made on one phone does not show on another, and stock
  is per device as described above. A shared, cross-device shop
  manager would need a database table behind this page.
- A completed sale is emailed to the business email in Setup (or to
  AutoFly's inbox when that is empty). Shipments and expenses are
  local records and are not emailed.
- Reports figures include cost prices, so share this page only with
  staff.

## Files

- `index.html` — page shell + address bootstrap
- `app.js` — all behavior
- `style.css` — all styling
- `data.json` — all content (business + brands + goods)
- `README.md` — this file

## Origin

Built fresh in AutoFly's template pattern from the feature model of
Retailer V1.0 by Jafar N. Aliyev (a GPL v3 Java desktop shop manager
with goods, brands, stock, sales, shipments, write-offs, expenses,
and HTML reports, backed by a database). No code, text, or files
were copied from it, and the original cannot run on static website
hosting as-is — this page is a new implementation of the shop-manager
idea for the web. Write-offs from the desktop original are not in
this web version.
