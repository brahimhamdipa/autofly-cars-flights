# Employee — one time-tracking page for every business

A shared employee time-tracking page: every business gets its own
private link and its own staff, jobs,
and time logs, but they all use this same page. There is no
`data.json` here — the business, its staff, and its time logs live
in the database. This folder REPLACES the old static employee
template (one folder per business, `data.json` + records in the
visitor's browser), the same move as POS replacing its static
template: the old `data.json` is kept for reference at
`~/workspace/build-drafts/employee/data.json.orig` and is not
shipped.

## What it does

- **Employees** — the public staff list: every staff member with
  their code, name, job, and note, plus a "Log time" button that
  jumps to the Log Time tab with that person preselected. "No
  employees yet" when the team is empty.
- **Log Time** — the clock-in form. Pick the employee, the date
  (today, visitor-local, by default), clock in, clock out
  (optional — a log with no clock-out is a clock-in only), and an
  optional note. Submitting shows
  "✓ Logged — time #TM-42: Anna Lopez on 2026-11-07, 09:00–17:30
  (8.5h)." (with no clock-out, just the clock-in time and no hours
  part) and emails a copy to AutoFly.
- **Records** — every time log for this business, newest first,
  with employee name + code, job, date, clock in/out, hours (1
  decimal), and note. Each row has Delete, with an in-page
  confirmation ("Delete this record?" + Yes, delete / Keep it) —
  never a native confirm(). The list refreshes on its own every
  5 seconds while the tab is open.
- **Setup** — the owner's page. Edit the business details (name,
  address, phone, hours, about) and the jobs list (add / remove)
  as a draft and upload it for AutoFly's approval; manage staff
  live (add, edit, delete — staff go live right away, no approval
  needed). The business is reloaded after every staff change.

## Passwords

Two passwords, like the diner, barbershop, and POS pages. The
**owner login** (username + password, set by the admin) opens
Setup. One shared **employee password** opens Log Time and
Records; businesses with none set stay fully open. Both live in
memory only — a reload asks again.

## RPCs (Supabase, `employee.sql`)

All calls go through the `rpc()` helper, which reads `res.text()`
first and parses only if non-empty, so void-returning RPCs (empty
bodies) are not misread as failures. The publishable key is public
by design, the same one the main AutoFly site ships.

- `get_employee_live(p_slug)` → `{slug, name, address, phone,
  hours, about, jobs, staff: [{id, code, name, job, note}]}`
- `employee_pass_status(p_slug)` → `'open'` / `'locked'`
- `check_employee_employee_pass(p_slug, p_password)` → boolean
- `check_employee_login(p_slug, p_u, p_p)` → boolean
- `get_employee_draft(p_slug, p_u, p_p)` → `{draft, live, status}`
  (the app also accepts a bare draft object)
- `save_employee_draft(p_slug, p_u, p_p, p_draft)` → void
- `submit_employee_draft(p_slug, p_u, p_p)` → void (the app saves
  first, then submits, then emails)
- `save_employee_staff(p_slug, p_u, p_p, p_staff)` → staff id
  (`p_staff` is `{id?, code, name, job, note, is_active}`; code and
  name are required)
- `delete_employee_staff(p_slug, p_u, p_p, p_staff_id)` → void
- `place_employee_timelog(p_slug, p_employee_code, p_date,
  p_clock_in, p_clock_out, p_note)` → time log id (the server
  looks the name and job up from the staff code and works the
  hours out; a clock-out earlier than clock-in wraps past
  midnight). No employee password is sent — the gate is enforced
  in the page by `check_employee_employee_pass` before the form
  is shown.
- `list_employee_records(p_slug, p_epass)` →
  `[{id, data, status, created_at}]`, newest first (`data` holds
  `employee_code`, `employee_name`, `job`, `date`, `clock_in`,
  `clock_out`, `hours`, `note`)
- `delete_employee_record(p_slug, p_epass, p_id)` → void

## Emails (best-effort, via the send-notification function)

- After a time log: subject `Employee time: <name> (<code>)`,
  table `employee_time`, record `{reference, employee, code, job,
  date, clock_in, clock_out, hours, note}`.
- After a draft upload: subject `Employee draft for approval:
  <name>`, table `employee_draft`, record `{slug, name}`.

## Honest limits

- This page records time entries only. It does not calculate pay,
  and no payroll is handled here.
- Records are now shared: a log made on any phone appears in
  Records on every phone (the old template kept records in one
  browser only).
- The demo team is fictional. Replace it in Setup with the real
  team. Demo seed (kept until he says delete): slug
  `demo-employee`, owner/demo and employee password all `demo`,
  staff EMP-101 Anna Lopez (Front desk), EMP-102 Omar Haddad
  (Kitchen), EMP-103 Sara Kim (Delivery), EMP-104 Youssef Benali
  (Cleaning); jobs Front desk, Kitchen, Delivery, Cleaning, Office.

## Files

- `index.html` — page shell + address bootstrap (loads
  `style.css` then `app.js` from its own computed base; the
  business comes from its own private link, never from a file)
- `app.js` — all behavior
- `style.css` — all styling (AutoFly style, copied from POS and
  adapted for the employee tabs)
- `README.md` — this file

## Origin

Built fresh in AutoFly's dynamic pattern (same as diner,
barbershop, and POS) from the feature model of the old static
employee template: staff with codes, jobs, and time records. No
code, text, or files were copied from the ETM desktop program the
old folder was named after (a 2008 C++ program that cannot run on
static web hosting) — this page is a new implementation of the
time-tracking idea for the web.
