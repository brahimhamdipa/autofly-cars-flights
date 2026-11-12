import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, HOLIDAY_PLAN_KEY, HOLIDAY_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import DemoInterestPopup from './DemoInterestPopup'
import FloatingAddToCart from './FloatingAddToCart'

// Sales page for the holiday rentals website (reached from More ▾ →
// Business Systems → Holiday, and from the Holiday submenu). One
// product only: a holiday rental business's own page with properties,
// dates and bookings, for $20/month. No card payment is taken here —
// the request form emails the owner, who then creates the business's
// link and login by hand. Nothing on this page promises instant
// signup. Connecting carts to the bank comes later.
//
// PRICE NOTE: the $20/month on this page is the assistant's choice
// mirroring the other systems — NOT confirmed by the owner,
// changeable on his word.
export default function HolidayPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(HOLIDAY_PLAN_KEY)
  const [form, setForm] = useState({ name: '', business: '', email: '', phone: '', message: '' })
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
        data: { car_id: null, car_name: 'Holiday Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Holiday request — ${form.name}`,
        emailExtras: { business_name: form.business.trim() },
      })
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your holiday rentals page.')
      setForm({ name: '', business: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🏖️ Your holiday rentals, booked online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own holiday rentals page for $20/month. No apps, no hardware, no commission.</p>
        <p>Guests browse your properties, pick their dates, and book a stay — all from any phone. You see every booking the moment it comes in.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>🎥 Watch how it works — 2 minutes</h3>
        <p>See what you get, how to get it, and how to use it — a quick video guide for holiday hosts.</p>
        <video controls preload="metadata" poster="/videos/holiday-guide-poster.jpg" src="/videos/holiday-guide.mp4" style={{ width: '100%', maxWidth: 720, borderRadius: 10, background: '#000' }} />
        <p style={{ marginTop: 10 }}>Prefer to read it? <a href="/guides/holiday-guide.pdf" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>Download the step-by-step guide (PDF)</a> — from buying it to taking your first booking.</p>
      </div>

      <div className="hero-card">
        <h3>What your holiday business gets</h3>
        <ul>
          <li><b>Your own holiday rentals page</b> — your business's name, properties, prices, hours and address. You'll get your own private link by email.</li>
          <li><b>Stays booked online</b> — guests pick a property, an arrival date, nights and guests, and leave their name and phone. You see every booking in Bookings.</li>
          <li><b>Nightly and peak rates</b> — show the standard rate and the high-season peak rate on every property, with the total worked out as guests book.</li>
          <li><b>Two passwords</b> — your own login for Setup, where you change your page, and one shared password you give your staff for Bookings.</li>
          <li><b>Your properties, your control</b> — add, edit, and delete properties yourself in Setup; they go live right away. Change the business details and send them for approval.</li>
          <li><b>No commission, ever</b> — you keep everything you earn. No hardware to buy, no app for guests to install.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell Yently you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>You get your link and login</b> — your business's own username and password, plus the employee password for your staff.</li>
          <li><b>Add your properties in Setup, and start taking bookings.</b></li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$20/month.</b> That's it — your holiday rentals page, your properties, and your bookings. No setup fee, no commission on your stays. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and Yently will be in touch to set up your holiday rentals page.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Holiday rentals page — ${HOLIDAY_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(HOLIDAY_PLAN_KEY)}>Add to cart — ${HOLIDAY_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo holiday rentals page</h3>
        <p>See the holiday rentals page working before you ask for one — tap below and we'll send you the demo link.</p>
        <button type="button" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
      </div>

      {demoOpen && <DemoInterestPopup systemName="Holiday rentals page" onClose={() => setDemoOpen(false)} />}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your holiday rentals online</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Business name" value={form.business} onChange={set('business')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your holiday rentals (optional) — where your properties are, how many, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>
      <FloatingAddToCart planKey={HOLIDAY_PLAN_KEY} name="Holiday rentals page" price={HOLIDAY_PLAN_PRICE} go={go} />
    </div>
  )
}
