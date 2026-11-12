import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, RENTALS_PLAN_KEY, RENTALS_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import DemoInterestPopup from './DemoInterestPopup'
import FloatingAddToCart from './FloatingAddToCart'

// Sales page for the car rental website (reached from More ▾ →
// Business Systems → Car Rental). One product only: a car rental
// company's own page with cars, drivers and bookings, for $20/month.
// No card payment is taken here — the request form emails the owner,
// who then creates the company's link and login by hand. Nothing on
// this page promises instant signup. Connecting carts to the bank
// comes later.
//
// PRICE NOTE: the $20/month on this page is the assistant's choice
// mirroring the other systems — NOT confirmed by the owner,
// changeable on his word.
export default function RentalsPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(RENTALS_PLAN_KEY)
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
        data: { car_id: null, car_name: 'Car Rental Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Car Rental request — ${form.name}`,
        emailExtras: { company_name: form.company.trim() },
      })
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your car rental page.')
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
        <h2 style={{ color: '#fff' }}>🚗 Your cars, rented online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own car rental page for $20/month. No apps, no hardware, no commission.</p>
        <p>Customers browse your cars, pick their dates, choose a driver or drive themselves — and you see every booking the moment it comes in.</p>
      </div>

      <div className="hero-card">
        <h3>What your rental company gets</h3>
        <ul>
          <li><b>Your own rental page</b> — your company's name, cars, prices per day, hours and address. You'll get your own private link by email.</li>
          <li><b>Bookings with dates and a total</b> — customers pick a car, a pickup date and a return date, and see the total (days × price per day) before they send it. You see every booking in Bookings.</li>
          <li><b>Drivers or self-drive</b> — list your drivers and let customers pick one, or let them drive the car themselves.</li>
          <li><b>Your cars, your control</b> — add, edit, and delete cars and drivers yourself in Setup; they go live right away. Change the company details and send them for approval.</li>
          <li><b>Two passwords</b> — your own login for Setup, where you change your page, and one shared password you give your staff for Bookings.</li>
          <li><b>Pay at pickup</b> — nothing is charged online. Customers pay when they collect the car.</li>
          <li><b>No commission, ever</b> — you keep everything you earn. No hardware to buy, no app for customers to install.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell Yently you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>You get your link and login</b> — your company's own username and password, plus the employee password for your staff.</li>
          <li><b>Add your cars and drivers in Setup, and start renting.</b></li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$20/month.</b> That's it — your car rental page, your cars, your drivers, and your bookings. No setup fee, no commission on your rentals. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and Yently will be in touch to set up your rental page.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Car rental page — ${RENTALS_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(RENTALS_PLAN_KEY)}>Add to cart — ${RENTALS_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo rental page</h3>
        <p>See the car rental page working before you ask for one — tap below and we'll send you the demo link.</p>
        <button type="button" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
      </div>

      {demoOpen && <DemoInterestPopup systemName="Car rental page" onClose={() => setDemoOpen(false)} />}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your rental company online</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Rental company name" value={form.company} onChange={set('company')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your rental company (optional) — how many cars, what you rent, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>
      <FloatingAddToCart planKey={RENTALS_PLAN_KEY} name="Car rental page" price={RENTALS_PLAN_PRICE} go={go} />
    </div>
  )
}
