import { useState } from 'react'
import { useBusinessCart, SAMPLE_PLAN_KEY, SAMPLE_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import FloatingAddToCart from './FloatingAddToCart'
import { submitAndNotify } from '../lib/notify'

// Simple Website page (reached from the Business Systems submenu,
// last link). This is the $10/month simple website sales page: one
// product only, a simple website for ANY kind of business — a barber
// is one website type (see the website_type table), a personal
// website is another. No card payment is taken here — ordering puts
// the order in front of the owner (see the shared business cart),
// who then builds the website. The request form below is a second
// way in, as on the Restaurants page. Nothing on this page promises
// text messages: reservations email the store, and that is what is
// sold.
export default function SimpleBarbershopPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(SAMPLE_PLAN_KEY)
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
        data: { car_id: null, car_name: 'Simple Website Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Simple website request — ${form.name}`,
        emailExtras: { website_name: form.shop.trim() },
      })
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your simple website.')
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
        <h2 style={{ color: '#fff' }}>🌐 Your website, online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own simple website for ${SAMPLE_PLAN_PRICE}/month. No tech skills needed.</p>
        <p>A simple website for your business — barbers, personal pages, and more. Customers find you, see what you offer, and get in touch from their phone.</p>
      </div>

      <div className="hero-card">
        <h3>What your website gets</h3>
        <ul>
          <li><b>Your own website</b> — your name, logo and pictures at the top, your services or content and prices in the middle, your address and hours.</li>
          <li><b>An email on every inquiry</b> — every message lands in your inbox right away, with the customer's name, phone and what they asked about.</li>
          <li><b>Easy to change</b> — new service, new price, new hours? Tell Yently and the page is updated. No software to install, nothing to maintain yourself.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>${SAMPLE_PLAN_PRICE}/month.</b> That's it — your simple website, for less than one haircut. No setup fee, no commission.</p>
        <p className="hint">Place your order below and Yently will be in touch to build your page with your own logo, services, prices and pictures.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Simple website — ${SAMPLE_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(SAMPLE_PLAN_KEY)}>Add to cart — ${SAMPLE_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card">
        <h3>Or send a request</h3>
        <p>Prefer to talk first? Send a request and Yently will be in touch about your simple website.</p>
        <form onSubmit={handleSubmit}>
          <label>Your name</label>
          <input required value={form.name} onChange={set('name')} />
          <label>Website name</label>
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
      <FloatingAddToCart planKey={SAMPLE_PLAN_KEY} name="Simple website" price={SAMPLE_PLAN_PRICE} go={go} />
      </div>
    </div>
  )
}
