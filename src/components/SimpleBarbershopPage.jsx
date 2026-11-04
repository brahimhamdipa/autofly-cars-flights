import { useState } from 'react'
import { useBarberCart, BARBER_PLAN_PRICE } from '../lib/BarberCartContext'
import { BarbersTopBar } from './BarbersMenu'
import { submitAndNotify } from '../lib/notify'

// Simple barbershop page (reached from the Barbers submenu, last link).
// This is the original $10/month static barber website sales page:
// one product only, a barber's own website. No card payment is taken
// here — ordering puts the order in front of the owner (see
// BarberCartPage), who then builds the barber's page. The request
// form below is a second way in, as on the Restaurants page.
// Nothing on this page promises text messages: reservations email
// the store, and that is what is sold.
export default function SimpleBarbershopPage({ go }) {
  const { count, addWebsite } = useBarberCart()
  const inCart = count > 0
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
        data: { car_id: null, car_name: 'Simple Barbershop Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Simple barbershop request — ${form.name}`,
        emailExtras: { barbershop_name: form.shop.trim() },
      })
      setStatus('✓ Sent! Thanks — AutoFly will be in touch to set up your simple barbershop page.')
      setForm({ name: '', shop: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <BarbersTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>✂️ Your barbershop, online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own website for ${BARBER_PLAN_PRICE}/month. No tech skills needed.</p>
        <p>Customers find you, see your services and prices, check how long the wait is, and book from their phone — while you just cut hair.</p>
      </div>

      <div className="hero-card">
        <h3>What your barber gets</h3>
        <ul>
          <li><b>Your own website</b> — your name, logo, slogan and pictures at the top, your services and prices in the middle, your address and hours, all in your colors.</li>
          <li><b>Online check-in with wait times</b> — customers add their name, pick a service and see their place in line before they come, just like the big chains.</li>
          <li><b>An email on every reservation</b> — every booking lands in the shop's inbox right away, with the customer's name, phone, service and time.</li>
          <li><b>Easy to change</b> — new service, new price, new hours? Tell AutoFly and the page is updated. No software to install, nothing to maintain yourself.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>${BARBER_PLAN_PRICE}/month.</b> That's it — your website, your booking page, and your reservation emails, for less than one haircut. No setup fee, no commission on your bookings.</p>
        <p className="hint">Place your order below and AutoFly will be in touch to build your page with your own logo, services, prices and pictures.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Barber website — ${BARBER_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('barber-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={addWebsite}>Add to cart — ${BARBER_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card">
        <h3>Or send a request</h3>
        <p>Prefer to talk first? Send a request and AutoFly will be in touch about your simple barbershop page.</p>
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
