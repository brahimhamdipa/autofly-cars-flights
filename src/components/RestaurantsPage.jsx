import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, RESTAURANT_PLAN_KEY, RESTAURANT_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import DemoInterestPopup from './DemoInterestPopup'

// Sales page for restaurant ordering (reached from More ▾ → Restaurants).
// One product only: a restaurant's own ordering page with a live
// kitchen screen, for $20/month. No card payment is taken here —
// ordering puts the order in front of the owner (see the cart page),
// who then creates the restaurant's link and login by hand.
// Nothing on this page promises instant signup: the owner sets the
// restaurant up after the request comes in. The request form below is
// a second way in — it emails the owner the same way the cart order
// does. Connecting carts to the bank comes later.
export default function RestaurantsPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(RESTAURANT_PLAN_KEY)
  const [form, setForm] = useState({ name: '', restaurant: '', email: '', phone: '', message: '' })
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
        data: { car_id: null, car_name: 'Restaurant Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Restaurant request — ${form.name}`,
        emailExtras: { restaurant_name: form.restaurant.trim() },
      })
      setStatus('✓ Sent! Thanks — AutoFly will be in touch to set up your restaurant page.')
      setForm({ name: '', restaurant: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🍽️ Your restaurant, taking orders online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own ordering page for $20/month. No apps, no hardware, no commission.</p>
        <p>Guests see the menu on their phones — but they can't order. Ordering is for your staff, with one shared employee password. Orders appear in your kitchen as they come — on every phone at once.</p>
      </div>

      <div className="hero-card">
        <h3>What your restaurant gets</h3>
        <ul>
          <li><b>Your own page</b> — your restaurant's name, menu, prices, hours and address at a link like autofly.us.com/diner?r=your-restaurant.</li>
          <li><b>A live kitchen screen</b> — orders from your staff's phones appear in the kitchen by themselves, no refresh. Tick dishes as they're cooked, fulfil orders when they're done.</li>
          <li><b>Two passwords</b> — your own login for Setup, and one shared employee password for ordering, the kitchen, and receipts. Guests see the menu; only your staff can order.</li>
          <li><b>Your menu, your control</b> — change dishes and prices yourself, send the new menu for approval, and it's live right away.</li>
          <li><b>No commission, ever</b> — you keep everything you sell. No hardware to buy, no app for guests to install — it works on the phones you already have.</li>
          <li><b>Receipts for customers</b> — every order can be shown and printed, right from the customer's phone.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell AutoFly you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>You get your link and login</b> — your restaurant's own username and password.</li>
          <li><b>Set up your menu, send it for approval, and start taking orders.</b></li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$20/month.</b> That's it — your page, your live kitchen, and your menu changes. No setup fee, no commission on your orders. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and AutoFly will be in touch to set up your restaurant.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Restaurant ordering page — ${RESTAURANT_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(RESTAURANT_PLAN_KEY)}>Add to cart — ${RESTAURANT_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo store</h3>
        <p>See the ordering page working before you ask for one — the demo restaurant is live, with the employee password <b>demo</b>.</p>
        <button type="button" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
      </div>

      {demoOpen && <DemoInterestPopup systemName="Restaurant ordering page" onClose={() => setDemoOpen(false)} />}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your restaurant online</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Restaurant name" value={form.restaurant} onChange={set('restaurant')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your restaurant (optional) — what you serve, how many tables, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>
    </div>
  )
}
