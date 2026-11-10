import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, BODYSHOP_PLAN_KEY, BODYSHOP_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import DemoInterestPopup from './DemoInterestPopup'
import FloatingAddToCart from './FloatingAddToCart'

// Sales page for the bodyshop management page (reached from More ▾
// → Restaurants → Bodyshop, and from the Bodyshop submenu). One
// product only: a bodyshop's own page with estimates, jobs, customers
// and loan cars, for $20/month. No card payment is taken here — the
// request form emails the owner, who then creates the bodyshop's link
// and login by hand. Nothing on this page promises instant signup.
// Connecting carts to the bank comes later.
//
// PRICE NOTE: the $20/month on this page is the assistant's choice
// mirroring the POS, Restaurants and Dealer pages — NOT confirmed by
// the owner, changeable on his word.
export default function BodyshopPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(BODYSHOP_PLAN_KEY)
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
        data: { car_id: null, car_name: 'Bodyshop Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Bodyshop request — ${form.name}`,
        emailExtras: { shop_name: form.shop.trim() },
      })
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your bodyshop page.')
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
        <h2 style={{ color: '#fff' }}>🔧 Your bodyshop, organised online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own bodyshop page for $20/month. No apps, no hardware, no commission.</p>
        <p>Customers request estimates online, you turn them into jobs, and you keep track of customers and loan cars — all from any phone.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>🎥 Watch how it works — 2 minutes</h3>
        <p>See what you get, how to get it, and how to use it — a quick video guide for bodyshop owners.</p>
        <video controls preload="metadata" poster="/videos/bodyshop-guide-poster.jpg" src="/videos/bodyshop-guide.mp4" style={{ width: '100%', maxWidth: 720, borderRadius: 10, background: '#000' }} />
        <p style={{ marginTop: 10 }}>Prefer to read it? <a href="/guides/bodyshop-guide.pdf" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>Download the step-by-step guide (PDF)</a> — from buying it to your first estimate.</p>
      </div>

      <div className="hero-card">
        <h3>What your shop gets</h3>
        <ul>
          <li><b>Your own bodyshop page</b> — your shop's name, hours and address. You'll get your own private link by email.</li>
          <li><b>Estimates requested online</b> — customers describe the damage, and you see every estimate in Estimates.</li>
          <li><b>Estimate → job in one tap</b> — accepting an estimate raises the job, with totals from parts + labour.</li>
          <li><b>Jobs with status and search</b> — follow every job from booked to done, and find any job in seconds.</li>
          <li><b>Customers and loan cars in one place</b> — every customer and every loan car, kept together with their jobs.</li>
          <li><b>Two passwords</b> — your own login for Setup, where you change your page, and one shared password you give your staff for Jobs, Estimates, Customers and Loan Cars.</li>
          <li><b>Your shop, your control</b> — change the shop details in Setup and send them for approval.</li>
          <li><b>No commission, ever</b> — you keep everything you earn. No hardware to buy, no app for customers to install.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell Yently you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>You get your link and login</b> — your shop's own username and password, plus the employee password for your staff.</li>
          <li><b>Add your customers and loan cars in the working tabs, and start taking estimates.</b></li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$20/month.</b> That's it — your bodyshop page, your estimates, and your jobs. No setup fee, no commission on your work. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and Yently will be in touch to set up your bodyshop.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Bodyshop management — ${BODYSHOP_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(BODYSHOP_PLAN_KEY)}>Add to cart — ${BODYSHOP_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo shop</h3>
        <p>See the bodyshop page working before you ask for one — tap below and we'll send you the demo link.</p>
        <button type="button" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
      </div>

      {demoOpen && <DemoInterestPopup systemName="Bodyshop management" onClose={() => setDemoOpen(false)} />}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your bodyshop online</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Shop name" value={form.shop} onChange={set('shop')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your shop (optional) — what you repair, how big your team is, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>
      <FloatingAddToCart planKey={BODYSHOP_PLAN_KEY} name="Bodyshop management" price={BODYSHOP_PLAN_PRICE} go={go} />
    </div>
  )
}
