import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, TV_PLAN_KEY, TV_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import FloatingAddToCart from './FloatingAddToCart'
import DemoInterestPopup from './DemoInterestPopup'

// Sales page for the TV gallery (reached from More ▾ → Business
// Systems → Add-ons → TV Gallery). One product only: a fullscreen
// page for a TV that shows the customer's own pictures, with a
// rolling message at the bottom. Two display types, one price
// ($2/month for both): Slideshow plays the pictures one after the
// other; One picture holds a single picture on a TV — the customer
// opens the same link on each TV and picks which picture it shows,
// and each TV remembers its picture. Up to 7 pictures — one picture
// per TV, so seven TVs can each show a different picture. No card
// payment is taken here — the request form emails the owner, who then
// creates the customer's upload form and TV link by hand, and the Add
// to cart card puts a tv_gallery_order row in front of the owner the
// same way (shared Business cart, BusinessCartContext +
// tv_gallery_order table, same pattern as the other Business Systems
// pages). Nothing on this page promises instant signup. Connecting
// carts to the bank comes later.
export default function TvGalleryPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(TV_PLAN_KEY)
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
        data: { car_id: null, car_name: 'TV Gallery Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `TV Gallery request — ${form.name}`,
        emailExtras: { business_name: form.business.trim() },
      })
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your TV gallery.')
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
        <h2 style={{ color: '#fff' }}>📺 Your pictures, on the big screen</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own TV gallery for $2/month — slideshow and one-picture display both included. One picture per TV, up to seven.</p>
        <p>Turn any TV into your display — your pictures fullscreen, with your message rolling across the bottom.</p>
      </div>

      <div className="hero-card">
        <h3>What you get</h3>
        <ul>
          <li><b>A fullscreen page for your TV</b> — your pictures fill the whole screen, with your message rolling across the bottom like the urgent messages on TV.</li>
          <li><b>Two ways to show them, both included</b> — Slideshow plays your pictures one after the other. One picture holds a single picture on a TV — open the same link on each TV and pick which picture it shows, and each TV remembers its picture.</li>
          <li><b>Up to 7 pictures</b> — one picture per TV, so seven TVs can each show a different picture.</li>
          <li><b>Change it anytime</b> — upload, replace, or delete pictures from your own upload page, and the TVs follow. No one has to touch the TV.</li>
          <li><b>Works in any TV browser</b> — no app to install, no stick to plug in. If the TV opens a website, it shows your gallery. Arrow keys on the remote move between pictures.</li>
          <li><b>Your own private link</b> — you'll get your own private link by email. Only people you share it with can open your gallery.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell Yently you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>You get your link and login</b> — your own upload page, plus the TV link for your screens.</li>
          <li><b>Upload up to 7 pictures, open the TV link on each TV, and pick slideshow or one picture per TV.</b></li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$2/month.</b> That's it — your TV gallery, your pictures, and your message, with the slideshow and the one-picture display both included. No setup fee, no extra charge per TV or per display type. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and Yently will be in touch to set up your TV gallery.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>TV Gallery page — ${TV_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(TV_PLAN_KEY)}>Add to cart — ${TV_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo gallery</h3>
        <p>See the TV gallery working before you ask for one — tap below and we'll send you the demo link.</p>
        <button type="button" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
      </div>

      {demoOpen && <DemoInterestPopup systemName="TV Gallery page" onClose={() => setDemoOpen(false)} />}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your TV gallery</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Business name" value={form.business} onChange={set('business')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your screens (optional) — how many TVs, what you want to show, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>

      <FloatingAddToCart planKey={TV_PLAN_KEY} name="TV Gallery page" price={TV_PLAN_PRICE} go={go} />
    </div>
  )
}
