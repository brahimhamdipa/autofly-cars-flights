# Barber intake form

DRAFT — not live yet. The owner asked to approve it first before it is
uploaded to the site or sent to any barber.

## What it is

A single page a barber fills in so AutoFly can build their barber page.
It collects exactly the intake checklist: shop, location, hours
(Monday–Sunday + holiday note), services (add/remove rows: name, price,
time, description, picture link), and page details (page word, header /
body / footer texts, text-message preference).

## How it works

- Submitting sends one email to AutoFly's inbox through the
  `send-notification` service: subject `Barber intake: <shop name>`,
  table label `barber_intake`, with every field in the record.
- No database row is written and no payment is taken here.
- Anyone with the link can fill it in, by design. This is an intake
  form, not a customer template: it has no Setup tab and no folder
  pass, and it is not listed as a template type in Admin Folder Passes.
- Pictures: the barber pastes picture links, or writes "will send
  separately" — the form has no file upload, so no attachment path to
  break.
- SMS honesty note is in the form itself: the text-message switch is
  stored, but SMS is not wired up yet — email is what works today.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other template
folders), `app.js`, `style.css`, `README.md`. No `data.json` — there is
no editable page content; the form is the page.

## Live address once approved + uploaded

`autofly.us.com/barber-intake`
