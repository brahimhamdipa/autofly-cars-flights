# Restaurant page — one folder per restaurant

This folder IS the restaurant's website. Everything the page shows comes
from `data.json` in this same folder, and the page works out its own
address from the URL — no folder name is written in the code.

## Make a new restaurant page

1. Copy this whole folder.
2. Paste it with the new name (for example `bistro`).
3. Open `yently.com/bistro` — the copy opens under its new name,
   with the same menu and setup. No code change, no redeploy step
   beyond putting the folder on the site.

Two things to know about a copy:

- The **web address** comes from the folder name automatically.
- The **displayed restaurant name** comes from `data.json` inside the
  folder. After copying, change the name there (or in the page's Setup
  tab) so the page shows the new restaurant's name, not the old one.

## Edit the menu, hours, and details

Open the page's **Setup** tab, edit whatever you need, and press
**Download data.json**. Then replace the `data.json` file inside this
folder with the downloaded file and reload the page. That is the whole
update process — and it is deliberately download-only, so a visitor
cannot change your live menu from the page itself.

You can also edit `data.json` directly. A menu item is:

```json
{ "name": "Grilled Chicken", "price": 14.00, "category": "Main courses", "description": "…" }
```

Put a picture file in the folder and set `"image": "that-file.jpg"` on
an item to show it. Put a logo file in the folder and set `"logo"` at
the top of `data.json` to show it in the header.

## How orders work

- **Menu** — what visitors see, with prices and an Add button.
- **My Order** — pick a table, adjust quantities, send to kitchen.
- **Kitchen** — tick each dish as it is cooked; when everything is
  cooked, **Fulfil order** moves it to finished orders.
- **Receipt** — pick a table, load its latest finished order, print it.

Orders live in the visitor's browser only (one list per restaurant
page), the same idea as the desktop app's local database. That means
the kitchen view on one phone does not see orders placed from another
phone. For a single-device setup or a demo it works as-is; for a
shared kitchen across devices, the orders need a shared backend, which
is a separate upgrade.

## Files in this folder

- `index.html` — the page shell (finds its own folder address).
- `app.js` — the whole app: menu, order, kitchen, receipt, setup.
- `style.css` — the look of the page.
- `data.json` — the restaurant: name, details, hours, tables, menu.
- `README.md` — this file.
