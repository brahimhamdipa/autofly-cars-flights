# Doctor template

A doctor's clinic page for AutoFly, built in the same pattern as the
restaurant (dine), houses, and barbershop templates: one self-contained
folder, live at `yently.com/<folder>`.

## Files

- `index.html` — the page shell. It works out the folder's own address
  from the URL and loads `style.css` and `app.js` from that address, so
  the page works with or without a trailing slash.
- `app.js` — doctors list, appointment booking, bookings on this device,
  and the Setup tab (including the Setup sign-in lock).
- `style.css` — the page's look.
- `data.json` — everything the owner edits: clinic details + doctors.
- `README.md` — this file.

## Copying it (making a new clinic page)

Copy the whole folder under a new name (for example `doctor2`), and
`yently.com/doctor2` opens that copy. Nothing else needs changing
for the address to work — but the *clinic name shown* comes from that
copy's `data.json`, so open the new page's Setup tab and change it there.

## Tabs

- **Doctors** — doctor cards: specialty, description, consultation fee,
  duration, and "Book with this doctor".
- **Book** — appointment form (doctor, name + phone required, email
  optional, date, time, reason). Booking shows an on-screen receipt and
  emails a copy to the clinic's email from Setup — or to AutoFly's inbox
  when that is empty. No payment is taken online.
- **Bookings** — appointments made on this device only, with Mark done
  and Cancel. A booking made on another phone does not appear here.
- **Setup** — edit the clinic details and the doctors list, then press
  "Download data.json". To put changes live, replace the folder's
  `data.json` with the downloaded file. Nothing on Setup changes the
  live page by itself — on purpose, so visitors cannot change it.

## Setup sign-in (the password)

Setup is locked the same way as the other template folders: in Admin,
the Folder Passes form sets a username and password for this folder.
While no pass is set, Setup opens freely; once one is set, Setup asks
for it and unlocks for that browser session only. The pass belongs to
the folder's name — rename a folder and set its pass again.

Because the folder has a `data.json`, it also appears in Admin's
Restaurant Pages list (copy / rename / delete) once that section is
available.

## Honest limits

- This page books appointments only. It does not diagnose, treat, or
  give medical advice, and it takes no payment.
- Bookings live in the visitor's browser, not in a shared system: the
  clinic's phone does not see another phone's bookings.
- The demo doctors are fictional. Replace them in Setup with the real
  clinic's doctors.

## Origin

The SourceForge "doctor" code this folder is named after turned out to
be an empty Angular dashboard shell (placeholder pages, no medical
content at all), so nothing was copied from it. This template was
written fresh in the dine pattern instead.
