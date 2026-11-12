import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, HOUSES_PLAN_KEY, HOUSES_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import DemoInterestPopup from './DemoInterestPopup'
import FloatingAddToCart from './FloatingAddToCart'

// Sales page for the houses website (reached from More ▾ → Business
// Systems → More Systems → Houses, and from the Systems hub). One
// product only: an estate agency's own page with listings, photos,
// a mortgage calculator and inquiries, for $20/month. No card payment
// is taken here — the request form emails the owner, who then creates
// the agency's link and login by hand. Nothing on this page promises
// instant signup. Connecting carts to the bank comes later.
export default function HousesPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(HOUSES_PLAN_KEY)
  const [form, setForm] = useState({ name: '', agency: '', email: '', phone: '', message: '' })
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
        data: { car_id: null, car_name: 'Houses Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Houses request — ${form.name}`,
        emailExtras: { agency_name: form.agency.trim() },
      })
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your houses page.')
      setForm({ name: '', agency: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🏠 Your homes, selling online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own houses page for $20/month. No apps, no hardware, no commission.</p>
        <p>Customers browse your homes, save their favorites, work out the mortgage, and ask about a home — all from any phone. You see every question the moment it comes in.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>🎥 Watch how it works — 2 minutes</h3>
        <p>See what you get, how to get it, and how to use it — a quick video guide for home sellers.</p>
        <video controls preload="metadata" poster="/videos/houses-guide-poster.jpg" src="/videos/houses-guide.mp4" style={{ width: '100%', maxWidth: 720, borderRadius: 10, background: '#000' }} />
        <p style={{ marginTop: 10 }}>Prefer to read it? <a href="/guides/houses-guide.pdf" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>Download the step-by-step guide (PDF)</a> — from buying it to selling your first home.</p>
      </div>

      <div className="hero-card">
        <h3>What your agency gets</h3>
        <ul>
          <li><b>Your own houses page</b> — your agency's name, homes, prices, hours and address. You'll get your own private link by email.</li>
          <li><b>Homes with photos</b> — customers search by city and price, flip through the pictures, and save the homes they like.</li>
          <li><b>Questions about any home</b> — customers ask about a home and leave their name and phone. You see every inquiry in Inquiries.</li>
          <li><b>A mortgage calculator</b> — customers work out the monthly payment on any home, with the full schedule, right on your page.</li>
          <li><b>Two passwords</b> — your own login for Setup, where you change your page, and one shared password you give your staff for Inquiries.</li>
          <li><b>Your listings, your control</b> — add, edit, and delete listings yourself in Setup; they go live right away. Change the agency details and send them for approval.</li>
          <li><b>No commission, ever</b> — you keep everything you sell. No hardware to buy, no app for customers to install.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell Yently you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>You get your link and login</b> — your agency's own username and password, plus the employee password for your staff.</li>
          <li><b>Add your homes in Setup, and start selling.</b></li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$20/month.</b> That's it — your houses page, your listings, and your inquiries. No setup fee, no commission on your sales. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and Yently will be in touch to set up your houses page.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Houses page — ${HOUSES_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(HOUSES_PLAN_KEY)}>Add to cart — ${HOUSES_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo houses page</h3>
        <p>See the houses page working before you ask for one — tap below and we'll send you the demo link.</p>
        <button type="button" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
      </div>

      {demoOpen && <DemoInterestPopup systemName="Houses page" onClose={() => setDemoOpen(false)} />}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your houses online</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Agency name" value={form.agency} onChange={set('agency')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your agency (optional) — what you sell, how many homes, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>
      <FloatingAddToCart planKey={HOUSES_PLAN_KEY} name="Houses page" price={HOUSES_PLAN_PRICE} go={go} />
    </div>
  )
}
