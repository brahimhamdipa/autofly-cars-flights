import { useState } from 'react'
import { useBusinessCart } from '../lib/BusinessCartContext'
import { placeBusinessOrder } from '../lib/businessData'
import { BusinessTopBar } from './BusinessMenu'

// My Cart for all Business Systems pages — mirrors PosCartPage's
// shape (top bar, hero intro, empty state, cart lines, checkout block
// at the bottom) but for the whole shared cart: every website plan
// the customer added, each on its own line. Placing the order inserts
// one row per plan into that plan's own order table and emails the
// owner once per plan, then clears the cart; the confirmation
// survives via lastOrder, same as the old per-system carts. No
// payment is taken here — the owner follows up to set each page up.
// Connecting carts to the bank comes later.
const PLAN_HINTS = {
  'r:website': 'Your own ordering page + live kitchen, for your restaurant.',
  'p:website': 'Your own register page + live stock + receipts, for your store.',
  'bb:website': 'Your own booking page + live queue + stopwatch, for your barbershop.',
  'd:website': 'Your own dealer page + test drives + trade-ins, for your dealership.',
  'e:website': 'Your own time page + records, for your team.',
  'bs:website': 'Your own bodyshop page + estimates + jobs, for your shop.',
  'b:website': 'Your own sample website, for your business.',
  'tv:website': 'Your own TV gallery page + up to 7 pictures, for your screens.',
}

export default function BusinessCartPage({ go }) {
  const { cart, count, removePlan, clearCart, lastOrder, setLastOrder } = useBusinessCart()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')

  const total = cart.reduce((s, i) => s + (Number(i.price) || 0), 0)

  const placeOrder = async (e) => {
    e.preventDefault()
    setSubmitting(true); setStatus('')
    try {
      const items = await placeBusinessOrder({ name, email, phone, note, items: cart })
      setLastOrder(items.map(i => ({ ...i, customer_name: name })))
      clearCart()
      setName(''); setEmail(''); setPhone(''); setNote('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setSubmitting(false)
  }

  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card">
        <h2>🛒 My Cart</h2>
        <p>Your Business Systems order. Place it below and AutoFly will be in touch to set up your pages.</p>
      </div>

      {count === 0 && (!lastOrder || lastOrder.length === 0) && (
        <div className="hero-card">
          <p>Your cart is empty.</p>
          <button onClick={() => go && go('restaurants')}>Browse Business Systems</button>
        </div>
      )}

      {lastOrder && lastOrder.length > 0 && (
        <div className="hero-card">
          <h3>✓ Order placed — thank you, {lastOrder[0].customer_name}!</h3>
          {lastOrder.map(i => (
            <p key={i.key}>{i.name} — ${Number(i.price).toFixed(2)}/month.</p>
          ))}
          <p>AutoFly will be in touch to set up your pages.</p>
          <button onClick={() => go && go('restaurants')}>Back to Business Systems</button>
        </div>
      )}

      {count > 0 && (
        <div>
          {cart.map(i => (
            <div className="hero-card" key={i.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <b>{i.name}</b>
                  <div className="hint">{PLAN_HINTS[i.key] || ''}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <b>${Number(i.price).toFixed(2)}/month</b>
                  <div><button type="button" className="btn-mini" onClick={() => removePlan(i.key)}>Remove</button></div>
                </div>
              </div>
            </div>
          ))}

          <form onSubmit={placeOrder} className="form-card">
            <h3>Checkout</h3>
            <label>Your name
              <input required placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
            </label>
            <label>Email
              <input required placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            </label>
            <label>Phone
              <input required placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
            </label>
            <label>Note (optional)
              <textarea placeholder="Your business name, city, anything that helps us set up your pages" value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <p><b>Total: ${total.toFixed(2)}/month</b></p>
            <button type="submit" disabled={submitting}>{submitting ? 'Placing…' : 'Place order'}</button>
            {status && <p className="status">{status}</p>}
          </form>
        </div>
      )}
    </div>
  )
}
