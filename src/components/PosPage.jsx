import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { RestaurantsTopBar } from './RestaurantsMenu'

// Sales page for the point of sale (reached from More ▾ → Restaurants
// → POS). One product only: a store's own register page with live
// stock and receipts, for $20/month. No card payment is taken here —
// the request form emails the owner, who then creates the store's
// link and login by hand. Nothing on this page promises instant
// signup. Connecting carts to the bank comes later.
export default function PosPage({ go }) {
  const [form, setForm] = useState({ name: '', store: '', email: '', phone: '', message: '' })
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
        data: { car_id: null, car_name: 'POS Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `POS request — ${form.name}`,
        emailExtras: { pos_store_name: form.store.trim() },
      })
      setStatus('✓ Sent! Thanks — AutoFly will be in touch to set up your point of sale.')
      setForm({ name: '', store: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <RestaurantsTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🧾 Your store's point of sale</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own register for $20/month. No apps, no hardware, no commission.</p>
        <p>Ring up sales from any phone. Stock drops by itself, receipts are kept, and the till works on the phones you already have.</p>
      </div>

      <div className="hero-card">
        <h3>What your store gets</h3>
        <ul>
          <li><b>Your own register page</b> — your store's name, items, prices, and tax at a link like autofly.us.com/pos?s=your-store.</li>
          <li><b>Stock that updates itself</b> — every sale lowers the stock on every phone at once. Out-of-stock items can't be rung up until you restock them.</li>
          <li><b>Receipts, kept</b> — every sale is saved with its reference, items, and totals. Void a sale and the stock goes back.</li>
          <li><b>Two passwords, like the restaurant pages</b> — your own login for Setup, and one shared cashier password for the register and the receipts.</li>
          <li><b>Your items, your control</b> — add, edit, and delete items yourself in Setup; they go live right away. Change the store details and send them for approval.</li>
          <li><b>No commission, ever</b> — you keep everything you sell. No hardware to buy, no app for staff to install.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell AutoFly you want it</b> — fill in the form below.</li>
          <li><b>You get your link and login</b> — your store's own username and password, plus the cashier password for your staff.</li>
          <li><b>Add your items in Setup, and start selling.</b></li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$20/month.</b> That's it — your register, your stock, and your receipts. No setup fee, no commission on your sales. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and AutoFly will be in touch to set up your point of sale.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo store</h3>
        <p>See the register working before you ask for one — the demo store is live, with the cashier password <b>demo</b>.</p>
        <a href="/pos?s=demo-pos" target="_blank" rel="noreferrer"><button type="button">Open the demo register</button></a>
      </div>

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your point of sale</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Store name" value={form.store} onChange={set('store')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your store (optional) — what you sell, how many items, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>
    </div>
  )
}
