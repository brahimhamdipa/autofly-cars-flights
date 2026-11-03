# Houses — a template website for selling homes

This folder is a complete, self-contained website for a real-estate business,
built the same way as the restaurant ("dine") template: one folder, no build
step, no server code.

## What is inside

- `index.html` — the page shell and tabs.
- `app.js` — listings, search, detail view with photo gallery, mortgage
  calculator, contact form, favorites, and Setup.
- `style.css` — the look of the page.
- `data.json` — ALL of the content: the business name, contact details, and
  every listing. Edit this file and the page changes.
- `standard_house.jpg` — a placeholder photo used by the demo listings.
  Replace it with real photos (see below).

## How to copy it for a new business

1. Copy this whole folder and paste it under a different name, for example
   `houses-miami`.
2. Done — the new address works automatically (the page works out its own
   address from the URL; no folder name is written anywhere in the code).
3. Open the copy's Setup tab and change the business name, the contact
   details, and the listings, then press "Download data.json" and replace the
   copy's `data.json` with the downloaded file.
4. Photos: add real photo files into the folder (next to `data.json`) and
   list their filenames in the listing's Photos field in Setup, one per line.
   The demo listings use `standard_house.jpg` as a placeholder — swap it out.

## How inquiries work

The Contact tab (and the "Ask about this home" button on a listing) sends the
message by email to that listing's contact email, or to the business email in
Setup when the listing has none. Until an email is set in Setup, messages go
to the AutoFly demo inbox. Nothing about the form changes when the folder is
copied — only the email in `data.json` decides where messages go.

## Favorites

Visitors can save homes with the heart button. Saved homes live in that
visitor's own browser, per folder — the same idea as the restaurant page's
per-device orders. A saved home on one phone does not appear on another phone.

## Admin and passes

Any folder that contains a `data.json` shows up automatically in AutoFly's
Admin folder manager, where it can be copied, renamed, or deleted. The same
folder list is what the website-pass form uses, so a pass (username and
password) can be set on any copied folder from Admin.

## Demo data

The three listings in `data.json` are fictional examples, there to show how
the page looks. Replace them in Setup before using the page for a real
business.
