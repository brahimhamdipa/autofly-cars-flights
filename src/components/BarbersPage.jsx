import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, BARBERSHOP_PLAN_KEY, BARBERSHOP_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import DemoInterestPopup from './DemoInterestPopup'
import FloatingAddToCart from './FloatingAddToCart'

// Advertising page for the live barbershop booking system (reached
// from More ▾ → Business Systems → Barber). One system: a shop's own
// booking page — public Book, live Serving Now
// with initials only, employee Bookings with a Stopwatch, owner Setup
// with draft approval. The $15/month plan is in the shared Business
// Systems cart (add to cart below, or send a request), and the demo
// barbershop card opens the demo-interest popup.
// Nothing on this page promises text messages.
export default function BarbersPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(BARBERSHOP_PLAN_KEY)
  const [form, setForm] = useState({ name: '', shop: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
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
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your booking page.')
      setForm({ name: '', shop: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>✂️ Your barbershop, taking bookings online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your booking page for $15/month. First month free. Live bookings, a live queue, and a stopwatch for every cut. No apps, no hardware.</p>
        <p>Customers book from their phones. Your queue runs live in the shop — and your customers can watch it live too, privately.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>🎥 Watch how it works — 2 minutes</h3>
        <p>See what you get, how to get it, and how to use it — a quick video guide for barbershop owners.</p>
        <video controls preload="metadata" poster="/videos/barber-guide-poster.jpg" src="/videos/barber-guide.mp4" style={{ width: '100%', maxWidth: 720, borderRadius: 10, background: '#000' }} />
        <p style={{ marginTop: 10 }}>Prefer to read it? <a href="/guides/barber-guide.pdf" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>Download the step-by-step guide (PDF)</a> — from buying it to taking your first booking.</p>
      </div>

      <div className="hero-card">
        <h3>What your barbershop gets</h3>
        <ul>
          <li><b>Your own booking page</b> — your name, services and prices, address and hours, at a link you can share anywhere.</li>
          <li><b>Bookings from any phone</b> — customers pick a service, a date and a time, and book in under a minute. No login, no app.</li>
          <li><b>Serving Now, live and private</b> — a public queue page showing initials only (B.H., not full names), who is being served, the running time, and how many people are in line. No phone numbers, no emails, nothing private.</li>
          <li><b>Bookings with a Stopwatch</b> — your team sees every booking with full details, marks them done or cancels them, and runs a stopwatch on each cut that shows live on Serving Now.</li>
          <li><b>Easy to change</b> — new service, new price, new hours? Change them in Setup and Yently approves them live. Nothing to install, nothing to maintain yourself.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ul>
          <li><b>Step 1 — Send a request</b> below with your shop's name.</li>
          <li><b>Step 2 — Yently sets you up</b> with your booking page and your logins: one for you (Setup), one shared password for your team (Bookings).</li>
          <li><b>Step 3 — Share your link.</b> Customers book, your team runs the queue, and Serving Now keeps everyone in the loop.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$15/month.</b> That's it — your booking page, live queue, and stopwatch. No setup fee, no commission on your bookings. First month free, cancel anytime.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Barbershop booking — ${BARBERSHOP_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(BARBERSHOP_PLAN_KEY)}>Add to cart — ${BARBERSHOP_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo barbershop</h3>
        <p>See the booking page working before you ask for one — tap below and we'll send you the demo link.</p>
        <button type="button" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
      </div>

      {demoOpen && <DemoInterestPopup systemName="Barbershop booking page" onClose={() => setDemoOpen(false)} />}

      <div className="hero-card">
        <h3>Request your booking page</h3>
        <p>Send a request and Yently will be in touch to set up your shop.</p>
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
      <FloatingAddToCart planKey={BARBERSHOP_PLAN_KEY} name="Barbershop booking page" price={BARBERSHOP_PLAN_PRICE} go={go} />
      </div>
    </div>
  )
}
