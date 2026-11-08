import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, DEALER_PLAN_KEY, DEALER_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'

// Sales page for the dealer website (reached from More ▾ → Restaurants
// → Dealer, and from the Dealer submenu). One product only: a car
// dealership's own page with vehicles, test drives and trade-ins, for
// $20/month. No card payment is taken here — the request form emails
// the owner, who then creates the dealership's link and login by hand.
// Nothing on this page promises instant signup. Connecting carts to the
// bank comes later.
//
// PRICE NOTE: the $20/month on this page is the assistant's choice
// mirroring the POS and Restaurants pages — NOT confirmed by the owner,
// changeable on his word.
export default function DealerPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(DEALER_PLAN_KEY)
  const [form, setForm] = useState({ name: '', dealership: '', email: '', phone: '', message: '' })
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
        data: { car_id: null, car_name: 'Dealer Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Dealer request — ${form.name}`,
        emailExtras: { dealer_name: form.dealership.trim() },
      })
      setStatus('✓ Sent! Thanks — AutoFly will be in touch to set up your dealership page.')
      setForm({ name: '', dealership: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🚗 Your dealership, selling online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own dealer page for $20/month. No apps, no hardware, no commission.</p>
        <p>Customers browse your cars, book a test drive, and offer their own car — all from any phone. You see every request the moment it comes in.</p>
      </div>

      <div className="hero-card">
        <h3>What your dealership gets</h3>
        <ul>
          <li><b>Your own dealer page</b> — your dealership's name, vehicles, prices, hours and address at a link like autofly.us.com/dealer?d=your-dealership.</li>
          <li><b>Test drives booked online</b> — customers pick a car, a date and a time, and leave their name and phone. You see every booking in Bookings.</li>
          <li><b>Sell-your-car requests</b> — customers offer you their car, and you see the details in Bookings.</li>
          <li><b>A finance calculator</b> — customers estimate their monthly payment on any car, right on your page.</li>
          <li><b>Two passwords, like the restaurant and POS pages</b> — your own login for Setup, and one shared employee password for Bookings.</li>
          <li><b>Your vehicles, your control</b> — add, edit, and delete vehicles yourself in Setup; they go live right away. Change the dealership details and send them for approval.</li>
          <li><b>No commission, ever</b> — you keep everything you sell. No hardware to buy, no app for customers to install.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell AutoFly you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>You get your link and login</b> — your dealership's own username and password, plus the employee password for your staff.</li>
          <li><b>Add your vehicles in Setup, and start selling.</b></li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$20/month.</b> That's it — your dealer page, your test drives, and your trade-ins. No setup fee, no commission on your sales. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and AutoFly will be in touch to set up your dealership.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Dealer website — ${DEALER_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(DEALER_PLAN_KEY)}>Add to cart — ${DEALER_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo dealership</h3>
        <p>See the dealer page working before you ask for one — the demo dealership is live, with the employee password <b>demo</b>.</p>
        <a href="/dealer?d=demo-dealer" target="_blank" rel="noreferrer"><button type="button">Open the demo dealership</button></a>
      </div>

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your dealership online</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Dealership name" value={form.dealership} onChange={set('dealership')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your dealership (optional) — what you sell, how many cars, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>
    </div>
  )
}
