# Diner — one folder for every restaurant

Diner replaces the one-folder-per-restaurant model. There is NO
`data.json` here on purpose: each restaurant's menu and info live in
the database, and the page knows which restaurant from the link.

## Links

- Visitor link: `autofly.us.com/diner?r=<slug>` — menu, ordering,
  and receipts. No login needed.
- Staff (Setup + Kitchen): same link, then the Setup or Kitchen tab
  asks for the restaurant's username + password. Credentials live in
  memory only — a reload asks for login again.
- New restaurants start with the demo menu (the old dine menu). The
  customer changes it in Setup.

## How changes go live

1. The customer edits in Setup and taps **Save draft** (private) or
   **Upload for approval** (sends the draft to AutoFly: email +
   a pending item in Admin).
2. Admin → ☰ → Manage → Diner Approvals: open Details, tap
   **Approve**. The draft becomes the live menu instantly — no file
   swap, no redeploy wait.
3. Visitors always see the last approved menu. A new save after an
   upload reverts the status to editing, so the customer uploads
   again.

## Kitchen (shared across devices)

Orders go to the shared order list for that restaurant. The Kitchen
tab polls the list every 5 seconds while open, so orders from any
phone appear with no manual refresh. Each restaurant sees only its
own orders. Cooked ticks, Fulfil, and Delete all write back to the
shared list.

## Receipts

A visitor's own sent orders are kept in that browser only, so the
Receipt tab can show and print them. The kitchen's fulfilment does
not change the visitor's copy.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other
template folders), `app.js`, `style.css`, `README.md`. No `data.json`
— so diner does not appear in Admin Folder Passes (there is no file
to pass-protect) and is not copy-managed: it is one folder for all.

## Style

Deliberately the AutoFly site style: navy `#161d44` header, blue
`#2563eb` buttons, `#f6f7fb` background, white shadow cards — the
same look as autofly.us.com, so a visitor feels no style change
moving from the main site to a restaurant page.
