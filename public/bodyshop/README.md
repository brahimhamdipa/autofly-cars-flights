# Bodyshop — one page for every bodyshop

A shared bodyshop manager: every shop gets its own link
(`autofly.us.com/bodyshop?b=<slug>`) and its own jobs, estimates,
customers, and loan cars, but they all use this same page. There is
no `data.json` here — the shop, its jobs, estimates, customers, and
loan cars live in the database. This replaces the old static
bodyshop template (the one-folder-per-shop copy with a `data.json`
and browser-only edits), the same move POS made from its static
template.

## What it does

- **Request Estimate** — the public form. Anyone with the link can
  ask for an estimate: name, phone, vehicle (required), email and
  insurer (optional), damage/notes. The request lands in Estimates
  as a Pending estimate and the shop is emailed
  (`Bodyshop estimate: <vehicle> (<name>)`). The confirmation
  reads `✓ Requested — estimate #EST-<id>: <vehicle> for <name>.
  The shop will be in touch.`
- **Jobs** — the jobs table: job number, customer, vehicle,
  insurer, estimate number, total, and status, with a search box
  (job number, customer, or vehicle) and a status filter. Change a
  job's status in place (In progress, Completed, Invoiced), delete
  a job, and add a new job from the form below the table. The list
  refreshes on its own every 5 seconds while the tab is open.
- **Estimates** — the estimates table: estimate number, customer,
  vehicle, parts, labour, total, status, and note. Accepting a
  pending estimate marks it Accepted and raises a job for it on
  the Jobs tab (the new job number is shown in the status line).
  Declining closes it without a job. Staff can also add an
  estimate below the table (a customer asking in person, or one
  that came in by phone). Delete per row.
- **Customers** — the customers table: name, phone, email,
  vehicle, and insurer, with add, edit, and delete.
- **Loan Cars** — cars lent to customers while their own car is
  in the shop: car number, vehicle, status, and job. Change the
  status (Available / On loan) and the job number in the row, then
  tap Update — setting a car back to Available clears its job.
  Add and delete loan cars.
- **Setup** — the owner's page. Edit the business details (name,
  about, address, phone, hours) as a draft and upload it for
  AutoFly's approval; approval makes it live instantly.

## Passwords

Two passwords, like the diner, barbershop, and POS pages. The
**owner login** (username + password, set by the admin) opens
Setup. One shared **employee password** opens the working tabs
(Jobs, Estimates, Customers, Loan Cars); shops with none set stay
fully open. Both live in memory only — a reload asks again.
Request Estimate is public and needs no password.

## The estimate → job → invoice workflow

The workflow is estimate, then job, then invoice: a customer asks
for an estimate (public form, or staff add it), the shop prices
parts + labour, Accept raises a job with that total and the
customer's insurer, and a finished job is marked Invoiced. The
estimate number stays on the job so the two can always be matched.

## Database (RPCs)

All access goes through RPCs on the shared Supabase project; there
is no direct table access from this page. The tables are
`bodyshop_shops`, `bodyshop_customers`, `bodyshop_estimates`,
`bodyshop_jobs`, and `bodyshop_loancars` (see
`~/workspace/build-drafts/bodyshop/bodyshop.sql`).

| RPC | Purpose |
| --- | --- |
| `get_bodyshop_live(p_slug)` | Public shop info: `{ slug, name, address, phone, hours, about }` |
| `bodyshop_pass_status(p_slug)` | `'locked'` or `'open'` — whether an employee password is set |
| `check_bodyshop_employee_pass(p_slug, p_password)` | Yes/no for the shared employee password |
| `check_bodyshop_login(p_slug, p_u, p_p)` | Yes/no for the owner login |
| `get_bodyshop_draft(p_slug, p_u, p_p)` | `{ draft, live, status }` — draft falls back to live details |
| `save_bodyshop_draft(p_slug, p_u, p_p, p_draft)` | Save the Setup draft (status back to `editing`) |
| `submit_bodyshop_draft(p_slug, p_u, p_p)` | Upload for approval (status to `pending`) + owner email |
| `place_bodyshop_estimate(p_slug, p_name, p_phone, p_vehicle, p_email, p_insurer, p_note)` | Public estimate request; returns the new id, number is `EST-<id>`; also keeps a customer record so phone/email/insurer are not lost |
| `list_bodyshop_data(p_slug, p_epass)` | `{ jobs, estimates, customers, loancars }` for this shop |
| `save_bodyshop_job(p_slug, p_epass, p_job)` | Add (or edit, with `id`) a job; number is `JOB-<id>` when blank |
| `update_bodyshop_job_status(p_slug, p_epass, p_job_id, p_status)` | In-place status change |
| `delete_bodyshop_job(p_slug, p_epass, p_job_id)` | Delete a job |
| `save_bodyshop_estimate(p_slug, p_epass, p_estimate)` | Staff add (or edit, with `id`) an estimate |
| `accept_bodyshop_estimate(p_slug, p_epass, p_estimate_id)` | Accept a Pending estimate; returns the new job's id, number is `JOB-<id>` |
| `update_bodyshop_estimate_status(p_slug, p_epass, p_estimate_id, p_status)` | Decline (or re-open) an estimate |
| `save_bodyshop_customer(p_slug, p_epass, p_customer)` | Add (or edit, with `id`) a customer |
| `delete_bodyshop_customer(p_slug, p_epass, p_customer_id)` | Delete a customer |
| `save_bodyshop_loancar(p_slug, p_epass, p_car)` | Add (or edit, with `id`) a loan car |
| `update_bodyshop_loancar_status(p_slug, p_epass, p_car_id, p_status, p_job_number)` | In-place status + job change |
| `delete_bodyshop_loancar(p_slug, p_epass, p_car_id)` | Delete a loan car |

Two notes for the SQL side:

- `delete_bodyshop_estimate(p_slug, p_epass, p_estimate_id)` is
  called by this page (in-page delete confirmation on Estimates)
  but was **not in `bodyshop.sql`** when the page was written —
  it needs adding in the same shape as `delete_bodyshop_job`.
- `place_bodyshop_estimate` takes the fields as separate
  parameters (not one JSON object), and `accept_bodyshop_estimate`
  returns the new job's **id** (the page builds `JOB-<id>` from
  it), not the job number.

## Emails

Two best-effort owner emails go through the shared
`send-notification` function (a failed email never fails the
action): `Bodyshop estimate: <vehicle> (<name>)` with table
`bodyshop_estimate` on a public request, and
`Bodyshop draft for approval: <name>` with table `bodyshop_draft`
on Upload for approval.

## Honest limits

- No payment is taken online: a job marked Invoiced is a record,
  not a payment.
- Totals, parts, and labour display with thousands separators
  (`$1,800`); amounts are stored as plain numbers.
- The employee password is enforced by the RPCs on the server,
  not just in the page, so it cannot be bypassed.

## Files

- `index.html` — page shell + address bootstrap
- `app.js` — all behavior
- `style.css` — all styling (AutoFly site style, plus the working tables)
- `README.md` — this file

No `data.json` — so bodyshop does not appear in Admin Folder
Passes (there is no file to pass-protect) and is not copy-managed:
it is one folder for all shops. The old template's `data.json`
is kept for reference at
`~/workspace/build-drafts/bodyshop/data.json.orig`, and its seed
content (Demo Bodyshop, EST-101–103, JOB-201–202, the three
customers, the three loan cars) lives on as the demo seed in
`bodyshop.sql`.

## Origin

Built fresh in AutoFly's dynamic pattern (same as diner,
barbershop, and POS) from the feature model of the old static
bodyshop template, which itself was built from the feature model
of BDA (Bodyshop Assistant), a Visual Basic 6 body-shop
management program (customer, employee, estimate, insurance,
jobs, loan vehicle, and time-keeping records, following the
estimate → job → invoice workflow). No code, text, images, or
files were copied from it, and the original cannot run on static
website hosting as-is — this page is a new implementation of the
bodyshop idea for the web.
