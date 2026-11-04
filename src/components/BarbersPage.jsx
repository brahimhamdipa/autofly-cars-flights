import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import BarbersMenu from './BarbersMenu'

// Advertising page for the live barbershop booking system (reached
// from More ▾ → Barbers). One system: a shop's own booking page at
// barbers?s=<slug> — public Book, live Serving Now with initials
// only, employee Bookings with a Stopwatch, owner Setup with draft
// approval. No price on this page yet and no cart here: requests
// come in through the form below and the owner sets each shop up
// by hand. Nothing on this page promises text messages.
export default function BarbersPage({ go }) {
  const [form, setForm] = useState({ name: '', shop: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setStatus('Sending your request...')
    try {
      await submitAndNotify({
        table: 'car_inquiries',
        data: { car_id: null, car_name: 'Barbershop Booking Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Barbershop booking request — ${form.name}`,
        emailExtras: { barbershop_name: form.shop.trim() },
      })
      setStatus('✓ Sent! Thanks — AutoFly will be in touch to set up your booking page.')
      setForm({ name: '', shop: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <div className="g-topbar"><BarbersMenu go={go} /></div>
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>✂️ Your barbershop, taking bookings online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Live bookings, a live queue, and a stopwatch for every cut. No apps, no hardware.</p>
        <p>Customers book from their phones. Your queue runs live in the shop — and your customers can watch it live too, privately.</p>
      </div>

      <div className="hero-card">
        <h3>What your barbershop gets</h3>
        <ul>
          <li><b>Your own booking page</b> — your name, services and prices, address and hours, at a link you can share anywhere.</li>
          <li><b>Bookings from any phone</b> — customers pick a service, a date and a time, and book in under a minute. No login, no app.</li>
          <li><b>Serving Now, live and private</b> — a public queue page showing initials only (B.H., not full names), who is being served, the running time, and how many people are in line. No phone numbers, no emails, nothing private.</li>
          <li><b>Bookings with a Stopwatch</b> — your team sees every booking with full details, marks them done or cancels them, and runs a stopwatch on each cut that shows live on Serving Now.</li>
          <li><b>Easy to change</b> — new service, new price, new hours? Change them in Setup and AutoFly approves them live. Nothing to install, nothing to maintain yourself.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ul>
          <li><b>Step 1 — Send a request</b> below with your shop's name.</li>
          <li><b>Step 2 — AutoFly sets you up</b> with your booking page and your logins: one for you (Setup), one shared password for your team (Bookings).</li>
          <li><b>Step 3 — Share your link.</b> Customers book, your team runs the queue, and Serving Now keeps everyone in the loop.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>Request your booking page</h3>
        <p>Send a request and AutoFly will be in touch to set up your shop.</p>
        <form onSubmit={handleSubmit}>
          <label>Your name</label>
          <input required value={form.name} onChange={set('name')} />
          <label>Barbershop name</label>
          <input required value={form.shop} onChange={set('shop')} />
          <label>Email</label>
          <input required type="email" value={form.email} onChange={set('email')} />
          <label>Phone</label>
          <input required value={form.phone} onChange={set('phone')} />
          <label>Message (optional)</label>
          <input value={form.message} onChange={set('message')} />
          <button type="submit" disabled={busy}>Send request</button>
          {status && <p className="status">{status}</p>}
        </form>
      </div>
    </div>
  )
}
