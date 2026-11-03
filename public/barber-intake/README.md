# Barber intake form (provider-form pattern)

A barber logs in with credentials the admin created, fills the intake
form, and submits. The submission waits for the admin's approval, which
builds the whole shop in one transaction.

## Flow

1. Admin → ☰ → Manage → Barber Intake Forms: create a form name,
   username, and password, and give those three to the barber.
   Passwords are stored readable, like employee passes and provider
   forms — throwaway passwords only, never the admin password.
2. Barber opens `autofly.us.com/barber-intake` and logs in with them.
   Credentials live in memory only and are never stored in the
   browser, so a reload asks for login again.
3. Barber fills the form (shop, location, hours Monday–Sunday +
   holiday note, services as add/remove rows, page details) and sends
   it. The answers land in Barber Intake Submissions with status
   `pending`, and AutoFly's inbox gets a copy (best effort — if the
   email fails, the submission itself still stands).
4. Admin → ☰ → Manage → Barber Intake Submissions: open Details,
   fix the page word there if it is taken, tap Approve (beside
   Delete). Approve builds, in one transaction: barber_store,
   barber_location, open_time, one barber_style row per service,
   website_domain (slug = page word), website_header, website_body,
   website_footer. If any piece fails, nothing is created.
5. The barber's page is then live at `autofly.us.com/<page word>`.

## Notes

- The form name is a login name only — it is NOT a page address, so
  it can never clash with barber page slugs, provider forms, or
  employee passes. The page word the barber picks below is the address,
  and Approve refuses it if it is already taken anywhere.
- Shop pictures: http(s) links in the pictures box are stored on the
  shop; anything else stays in the submission for the admin to add.
- Style pictures: one http(s) link per service is stored on the style.
- SMS honesty note is in the form itself: the text-message switch is
  stored, but SMS is not wired up yet — email is what works today.

## Files

`index.html` (slash-proof bootstrap, same pattern as the other template
folders), `app.js`, `style.css`, `README.md`. No `data.json` — there is
no editable page content; the form is the page. No Setup tab and no
folder pass: the intake login IS the gate.
