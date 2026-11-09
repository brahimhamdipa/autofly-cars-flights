import { useState } from 'react'
import { useBusinessCart, CLEAN_PLAN_KEY, CLEAN_PLAN_PRICE } from '../lib/BusinessCartContext'
import { insertCleanLinkOrder, saveCleanLinkMeta } from '../lib/cleanLinkData'
import { BusinessTopBar } from './BusinessMenu'
import FloatingAddToCart from './FloatingAddToCart'

// Sales page for the Clean Link add-on (reached from More ▾ →
// Business Systems → Add-ons → Clean Link, and from the hub). One
// product: a short, clean address for the customer's own shop —
// yently.com/<their-name> instead of yently.com/pos?s=<slug>.
// Works for every Business System and for Yently Kids. $2/month.
// No card payment is taken here — the request form inserts a
// clean_link_order row (with the shop and the slug they want) and
// emails the owner, who then activates it with one click in Admin
// (Clean Link Orders); the Add to cart card puts the same order row
// in front of the owner through the shared Business cart. The shop
// details travel with the order (see cleanLinkData.js) because the
// shared cart has no per-item slot for them. Nothing on this page
// promises instant setup. The Premium subdomain version
// (<slug>.yently.com) is NOT built yet — it needs Vercel Pro for
// wildcard domains, and is a later, separate add-on.
const SYSTEMS = [
  { label: 'Restaurant', value: 'diner' },
  { label: 'POS', value: 'pos' },
  { label: 'Barbershop', value: 'barbers' },
  { label: 'Dealer', value: 'dealer' },
  { label: 'Employee', value: 'employee' },
  { label: 'Bodyshop', value: 'bodyshop' },
  { label: 'Kids — Math', value: 'kids-math' },
  { label: 'Kids — English', value: 'kids-english' },
  { label: 'Kids — Arabic', value: 'kids-arabic' },
  { label: 'Kids — French', value: 'kids-french' },
  { label: 'Kids — Spanish', value: 'kids-spanish' },
  { label: 'Kids — Science', value: 'kids-science' },
  { label: 'Kids — Geography', value: 'kids-geography' },
  { label: 'Kids — Coding', value: 'kids-coding' },
  { label: 'Kids — Reading', value: 'kids-reading' },
]

function normSlug(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '')
}

export default function CleanLinkPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(CLEAN_PLAN_KEY)
  const [form, setForm] = useState({ name: '', business: '', email: '', phone: '', system: '', shop_slug: '', clean_slug: '', message: '' })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const shopReady = form.system && normSlug(form.shop_slug) && normSlug(form.clean_slug)

  const handleAddToCart = () => {
    if (!shopReady) return
    saveCleanLinkMeta({ system: form.system, shop_slug: normSlug(form.shop_slug), clean_slug: normSlug(form.clean_slug) })
    addPlan(CLEAN_PLAN_KEY)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setStatus('Sending your request...')
    try {
      await insertCleanLinkOrder({
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone,
        business_name: form.business,
        plan: 'Clean Link',
        price: CLEAN_PLAN_PRICE,
        note: form.message,
        system: form.system,
        shop_slug: normSlug(form.shop_slug),
        clean_slug: normSlug(form.clean_slug),
      }, { plan: 'Clean Link', price: CLEAN_PLAN_PRICE })
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your clean link.')
      setForm({ name: '', business: '', email: '', phone: '', system: '', shop_slug: '', clean_slug: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🔗 Your shop, at a clean address</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own clean link for $2/month — yently.com/your-name instead of a long link with a question mark in it.</p>
        <p>Short enough to print on a menu, a card, or a shop window — and easy for your customers to remember and type.</p>
      </div>

      <div className="hero-card">
        <h3>What you get</h3>
        <ul>
          <li><b>A clean link for your shop</b> — yently.com/your-name, for any Business System (Restaurant, POS, Barbershop, Dealer, Employee, Bodyshop) and for Yently Kids. Your customers open it and land straight on your page.</li>
          <li><b>Your old link keeps working</b> — the clean link is an extra address for the same shop. Nothing you already shared stops working.</li>
          <li><b>One link, one shop</b> — the name you pick is yours alone. First come, first served.</li>
          <li><b>Easy to share</b> — print it, say it, text it. No question mark, no code, nothing to mistype.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell Yently your shop and the name you want</b> — fill in the form below, or add it to your cart.</li>
          <li><b>Yently sets it up</b> — your clean link is switched on for your shop.</li>
          <li><b>Share it</b> — yently.com/your-name opens your shop, and your old link still works too.</li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$2/month.</b> That's it — your clean link, for one shop. No setup fee, no charge per click. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and Yently will be in touch to set up your clean link.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Clean Link — ${CLEAN_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <div>
            <button onClick={handleAddToCart} disabled={!shopReady}>Add to cart — ${CLEAN_PLAN_PRICE}/month</button>
            {!shopReady && <p className="hint">Pick your system and type your shop and the clean name you want below first.</p>}
          </div>
        )}
      </div>

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your clean link</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Business name" value={form.business} onChange={set('business')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="row">
          <select required value={form.system} onChange={set('system')}>
            <option value="">Which system is your shop on?</option>
            {SYSTEMS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          <input required placeholder="Your shop's current slug (the part after ?s=, ?r= … e.g. demo-pos)" value={form.shop_slug} onChange={set('shop_slug')} />
        </div>
        <div className="row">
          <input required placeholder="The clean name you want (e.g. myrestaurant)" value={form.clean_slug} onChange={set('clean_slug')} />
        </div>
        <textarea className="big-message" placeholder="Anything else that helps (optional) — your shop's current link, a second choice of name, anything" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>

      <FloatingAddToCart planKey={CLEAN_PLAN_KEY} name="Clean Link" price={CLEAN_PLAN_PRICE} go={go} />
    </div>
  )
}
