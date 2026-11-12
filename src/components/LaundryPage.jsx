import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, LAUNDRY_PLAN_KEY, LAUNDRY_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import DemoInterestPopup from './DemoInterestPopup'
import FloatingAddToCart from './FloatingAddToCart'

// Sales page for the laundry website (reached from More ▾ →
// Business Systems → Laundry). One product only: a laundry's own
// page with services, prices and online orders with pickup or
// delivery, for $20/month. No card payment is taken here — the
// request form emails the owner, who then creates the laundry's
// link and login by hand. Nothing on this page promises instant
// signup. Connecting carts to the bank comes later.
export default function LaundryPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(LAUNDRY_PLAN_KEY)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', message: '' })
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
        data: { car_id: null, car_name: 'Laundry Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Laundry request — ${form.name}`,
        emailExtras: { company_name: form.company.trim() },
      })
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your laundry page.')
      setForm({ name: '', company: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🧺 Your laundry, ordered online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own laundry page for $20/month. No apps, no hardware, no commission.</p>
        <p>Customers browse your services and prices, order online, pick pickup or delivery — and you see every order the moment it comes in.</p>
      </div>

      <div className="hero-card">
        <h3>What your laundry gets</h3>
        <ul>
          <li><b>Your own laundry page</b> — your laundry's name, services, prices, hours and address. You'll get your own private link by email.</li>
          <li><b>Orders with pickup or delivery</b> — customers pick their items, choose pickup or delivery, and see the total before they send it. You see every order in Orders.</li>
          <li><b>Status tracking</b> — every order moves from pending to washing to ready to delivered, so you and your customers always know where it stands.</li>
          <li><b>Your services, your control</b> — add, edit, and delete services and prices yourself in Setup; they go live right away. Change the laundry details and send them for approval.</li>
          <li><b>Two passwords</b> — your own login for Setup, where you change your page, and one shared password you give your staff for Orders.</li>
          <li><b>Pay on pickup or delivery</b> — nothing is charged online. Customers pay when they collect their laundry or when it arrives.</li>
          <li><b>No commission, ever</b> — you keep everything you earn. No hardware to buy, no app for customers to install.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell Yently you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>You get your link and login</b> — your laundry's own username and password, plus the employee password for your staff.</li>
          <li><b>Add your services and prices in Setup, and start taking orders.</b></li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$20/month.</b> That's it — your laundry page, your services, your prices, and your orders. No setup fee, no commission on your orders. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and Yently will be in touch to set up your laundry page.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Laundry page — ${LAUNDRY_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(LAUNDRY_PLAN_KEY)}>Add to cart — ${LAUNDRY_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo laundry page</h3>
        <p>See the laundry page working before you ask for one — tap below and we'll send you the demo link.</p>
        <button type="button" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
      </div>

      {demoOpen && <DemoInterestPopup systemName="Laundry page" onClose={() => setDemoOpen(false)} />}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your laundry online</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Laundry name" value={form.company} onChange={set('company')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your laundry (optional) — your services, prices, pickup or delivery, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>
      <FloatingAddToCart planKey={LAUNDRY_PLAN_KEY} name="Laundry page" price={LAUNDRY_PLAN_PRICE} go={go} />
    </div>
  )
}
