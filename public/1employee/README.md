# Employee template

An employee time page for AutoFly, built in the same pattern as the
restaurant (dine), houses, barbershop, and doctor templates: one
self-contained folder, live at `autofly.us.com/<folder>`.

## Files

- `index.html` — the page shell. It works out the folder's own address
  from the URL and loads `style.css` and `app.js` from that address, so
  the page works with or without a trailing slash.
- `app.js` — employees list, time logging, records on this device,
  and the Setup tab (including the Setup sign-in lock).
- `style.css` — the page's look.
- `data.json` — everything the owner edits: business details,
  employees, and jobs.
- `README.md` — this file.

## Copying it (making a new team page)

Copy the whole folder under a new name (for example `employee2`), and
`autofly.us.com/employee2` opens that copy. Nothing else needs changing
for the address to work — but the *business name shown* comes from that
copy's `data.json`, so open the new page's Setup tab and change it there.

## Tabs

- **Employees** — employee cards: code, name, job, note, and "Log time".
- **Log Time** — time record form (employee, job, date, time, note).
  Saving shows an on-screen receipt and emails a copy to the business
  email from Setup — or to AutoFly's inbox when that is empty.
- **Records** — records made on this device only, with Mark done
  and Cancel. A record made on another phone does not appear here.
- **Setup** — edit the business details, the employees list, and the
  jobs list, then press "Download data.json". To put changes live,
  replace the folder's `data.json` with the downloaded file. Nothing
  on Setup changes the live page by itself — on purpose, so visitors
  cannot change your team.

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

- This page records time entries only. It does not calculate pay, and
  no payroll is handled here.
- Records live in the visitor's browser, not in a shared system: the
  business phone does not see another phone's records.
- The demo employees are fictional. Replace them in Setup with the real
  team.

## Origin

The SourceForge "etm" code this folder is named after is ETM (Employee
Time Management): two GPL v2 C++ wxWidgets desktop programs from 2008
— a touch-screen time logger and a manager that reads the time data
from a MySQL database. A desktop program with a MySQL backend cannot
run on static web hosting, so nothing was copied from it. This template
was written fresh in the dine pattern, from its feature model only:
employees with codes, jobs, and time records.
