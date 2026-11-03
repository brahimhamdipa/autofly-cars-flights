# Bodyshop template

A self-contained job-management page for a car body repair shop:
estimates, jobs, customers, and loan cars. Copy this whole folder
under a new name and the copy just works at its new address — the
page works out its own address from the URL, so no folder name is
written in the code.

## What it does

- **Jobs** — the jobs table: job number, customer, vehicle,
  insurer, estimate number, total, and status, with search and a
  status filter. Change a job's status in place (In progress,
  Completed, Invoiced), delete a job, and add a new job from the
  form below the table.
- **Estimates** — the estimates table: estimate number, customer,
  vehicle, parts, labour, total, status, and note. Accepting a
  pending estimate marks it Accepted and raises a job for it on
  the Jobs tab — the estimate → job → invoice workflow.
  Declining closes it without a job.
- **Customers** — the customers table: name, phone, email,
  vehicle, and insurer, with add, edit, and delete.
- **Loan Cars** — cars lent to customers while their own car is
  in the shop: car number, vehicle, status, and job. Book an
  available car out against an in-progress job, return it when
  the job is done, and add or delete loan cars.
- **Setup** — edit the business, then press “Download data.json”.
  To put changes live, replace the folder's `data.json` with the
  downloaded file. Nothing on Setup changes the live page by
  itself, on purpose.

## Sign-in

This page is a business tool, so the folder pass guards the whole
page, not just Setup. It opens freely until the admin sets a
username + password for this folder in Admin → Folder Passes.
After that, the page asks for that pass and unlocks for the
browser session only. The password itself is never sent to the
page: the database only answers yes or no.

## Honest limits

- Jobs, estimates, customers, and loan cars edited on their tabs
  are saved in this browser only. A change made on one phone
  does not show on another until the owner exports it from Setup
  and replaces the folder's `data.json`. A shared, cross-device
  system would need a database table behind this page.
- No payment is taken online: a job marked Invoiced is a record,
  not a payment.

## Files

- `index.html` — page shell + address bootstrap
- `app.js` — all behavior
- `style.css` — all styling
- `data.json` — all content (business + jobs + estimates +
  customers + loan cars)
- `README.md` — this file

## Origin

Built fresh in AutoFly's template pattern from the feature model
of BDA (Bodyshop Assistant), a Visual Basic 6 body-shop
management program (customer, employee, estimate, insurance,
jobs, loan vehicle, and time-keeping records, following the
estimate → job → invoice workflow). No code, text, images, or
files were copied from it, and the original cannot run on static
website hosting as-is — this page is a new implementation of the
bodyshop idea for the web.
