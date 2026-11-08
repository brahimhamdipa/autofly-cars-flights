import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, CHAT_PLAN_KEY, CHAT_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import FloatingAddToCart from './FloatingAddToCart'
import DemoInterestPopup from './DemoInterestPopup'

// Sales page for Live Chat (reached from More ▾ → Business
// Systems → Add-ons → Live Chat, and from the demo's "Want this
// for your business?" button). One product only: a chat bubble on
// the customer's own website, so their visitors can tap it and
// message them — no account needed for the visitor, and every
// message reaches the owner by email. $3/month, first month free,
// no setup fee. No card payment is taken here — the request form
// emails the owner, who then adds the chat bubble to the customer's
// website and sets up the owner login by hand, and the Add to cart
// card puts a live_chat_order row in front of the owner the same
// way (shared Business cart, BusinessCartContext +
// live_chat_order table, same pattern as the other Business Systems
// pages and the TV Gallery add-on). Nothing on this page promises
// instant signup. Connecting carts to the bank comes later.
export default function LiveChatPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(CHAT_PLAN_KEY)
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
        data: { car_id: null, car_name: 'Live Chat Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Live Chat request — ${form.name}`,
        emailExtras: { business_name: form.business.trim() },
      })
      setStatus('✓ Sent! Thanks — AutoFly will be in touch to set up live chat for your website.')
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
        <h2 style={{ color: '#fff' }}>💬 Chat with your visitors, right on your website</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own live chat for $3/month — first month free. No setup fee.</p>
        <p>A chat bubble on your website — visitors tap it and message you, no account needed for them.</p>
      </div>

      <div className="hero-card">
        <h3>What you get</h3>
        <ul>
          <li><b>A chat bubble on your own website</b> — visitors tap it and message you, without creating an account.</li>
          <li><b>Every message reaches you by email</b> — nothing to install, nothing to watch all day.</li>
          <li><b>Your business name on it</b> — the chat opens with your name and greeting, so visitors know they're talking to you.</li>
          <li><b>Works on any website AutoFly builds for you</b> — restaurant, shop, barber, dealer, clinic, any of the Business Systems pages.</li>
          <li><b>One chat per business</b> — the chat on your page talks only to you, never to another business.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell AutoFly you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>AutoFly adds the chat bubble to your website</b> and sets up your owner login by hand.</li>
          <li><b>Visitors tap the bubble and message you</b> — every message reaches you by email.</li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$3/month.</b> That's it — the chat bubble on your website, your business name on it, and every message to your email. No setup fee. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and AutoFly will be in touch to set up live chat for your website.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Live chat page — ${CHAT_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(CHAT_PLAN_KEY)}>Add to cart — ${CHAT_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the live demo</h3>
        <p>See the chat working before you ask for one — a demo café page with the chat bubble, ready to tap.</p>
        <button type="button" onClick={() => go && go('demo-live-chat')}>Open the live demo</button>
        <div style={{ marginTop: 10 }}>
          <button type="button" className="link-btn" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
        </div>
      </div>

      {demoOpen && <DemoInterestPopup systemName="Live chat page" onClose={() => setDemoOpen(false)} />}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get live chat</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Business name" value={form.business} onChange={set('business')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your website (optional) — which page the chat goes on, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>

      <FloatingAddToCart planKey={CHAT_PLAN_KEY} name="Live chat page" price={CHAT_PLAN_PRICE} go={go} />
    </div>
  )
}
