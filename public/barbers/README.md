# Barbers — one folder for every barber shop

Barbers mirrors diner: there is NO `data.json` here on purpose. Each
shop's services and info live in the database, and the page knows
which shop from the link.

## Links

- Visitor link: `autofly.us.com/barbers?s=<slug>` — the Book tab
  (anyone can book an appointment, no login) and the Serving Now
  tab (public, initials only).
- Bookings: the Bookings tab asks for the shop's shared employee
  password — one password for everybody, set by the admin in
  Barbershop Shops and given to the owner with the Setup login.
  Shops with no employee password set keep Bookings open, as diner
  does for ordering.
- Setup only: the Setup tab asks for the shop's username +
  password. Credentials live in memory only — a reload asks for
  login again.
- New shops start with the demo services (Haircut, Beard trim,
  Hot towel shave). The customer changes them in Setup.

## How changes go live

1. The customer edits in Setup and taps **Save draft** (private) or
   **Upload for approval** (sends the draft to AutoFly: email +
   a pending item in Admin).
2. Admin → ☰ → Manage → Barbershop Approvals: open Details, tap
   **Approve**. The draft becomes live instantly — no file swap,
   no redeploy wait.
3. Visitors always see the last approved services. A new save after
   an upload reverts the status to editing, so the customer uploads
   again.

## Bookings and the Stopwatch

Bookings go to the shared list for that shop. The Bookings tab
needs the employee password and polls the list every 5 seconds
while open, so bookings from any phone appear with no manual
refresh. Each shop sees only its own bookings. Beside every
Cancel button sits the **Stopwatch**: the barber presses it when
starting a cut (it counts up from that moment) and presses Stop
when done. Mark done and Cancel clear the stopwatch. Past
bookings (done/cancelled) list below without buttons.

## Serving Now (public, private by construction)

Serving Now shows today's active bookings with **initials only**
(B.H. for Brahim HAMDI, M. for a single name) — no full name, no
phone, no email, no note, no buttons. The customer being served
shows the running stopwatch time, ticking every second; waiting
customers show as Waiting. The count at the top is the number of
people in line. The privacy lives in the database call itself:
`list_barbershop_serving` never sends the private fields, so the
page cannot leak what it never receives.

## Footer and tabs

The footer is centered, on two lines: the address/phone/hours line
first, then "Powered by AutoFly". The Book / Bookings / Serving
Now / Setup tabs are centered inside the oval, including on narrow
screens where they wrap. The black ↑ Top pill sits bottom-left,
always visible.
