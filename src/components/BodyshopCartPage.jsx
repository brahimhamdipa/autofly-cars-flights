import { useState } from 'react'
import { useBodyshopCart, BODYSHOP_PLAN_KEY, BODYSHOP_PLAN_NAME, BODYSHOP_PLAN_PRICE } from '../lib/BodyshopCartContext'
import { insertBodyshopOrder } from '../lib/bodyshopData'
import { BodyshopTopBar } from './BodyshopMenu'

// My Cart for bodyshop management — mirrors DealerCartPage's
// shape (top bar, hero intro, empty state, cart lines, checkout block
// at the bottom) but for the single $20/month bodyshop-management
// plan. Placing the order inserts a bodyshop_order row and emails the
// owner, then clears the cart; the confirmation survives via
// lastOrder, same as the dealer cart. No payment is taken here — the
// owner follows up to set the bodyshop up. Connecting carts to the
// bank comes later.
export default function BodyshopCartPage({ go }) {
  const { cart, count, setQty, clearCart, lastOrder, setLastOrder } = useBodyshopCart()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')

  const inCart = (cart[BODYSHOP_PLAN_KEY] || 0) > 0

  const placeOrder = async (e) => {
    e.preventDefault()
    setSubmitting(true); setStatus('')
    try {
      await insertBodyshopOrder({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        plan: BODYSHOP_PLAN_NAME,
        price: BODYSHOP_PLAN_PRICE,
        note,
      }, { plan: BODYSHOP_PLAN_NAME, price: BODYSHOP_PLAN_PRICE })
      setLastOrder([{ plan: BODYSHOP_PLAN_NAME, price: BODYSHOP_PLAN_PRICE, customer_name: name }])
      clearCart()
      setName(''); setEmail(''); setPhone(''); setNote('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setSubmitting(false)
  }

  return (
    <div>
      <BodyshopTopBar go={go} />
      <div className="hero-card">
        <h2>🛒 My Cart</h2>
        <p>Your bodyshop management order. Place it below and AutoFly will be in touch to set up your bodyshop with your own link, login, estimates and jobs.</p>
      </div>

      {count === 0 && (!lastOrder || lastOrder.length === 0) && (
        <div className="hero-card">
          <p>Your cart is empty.</p>
          <button onClick={() => go && go('bodyshop')}>See the bodyshop management</button>
        </div>
      )}

      {lastOrder && lastOrder.length > 0 && (
        <div className="hero-card">
          <h3>✓ Order placed — thank you, {lastOrder[0].customer_name}!</h3>
          <p>{lastOrder[0].plan} — ${Number(lastOrder[0].price).toFixed(2)}/month. AutoFly will be in touch to set up your bodyshop.</p>
          <button onClick={() => go && go('bodyshop')}>Back to Bodyshop</button>
        </div>
      )}

      {inCart && (
        <div>
          <div className="hero-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <b>{BODYSHOP_PLAN_NAME}</b>
                <div className="hint">Your own bodyshop page + estimates, jobs, customers and loan cars, for your shop.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b>${BODYSHOP_PLAN_PRICE.toFixed(2)}/month</b>
                <div><button type="button" className="btn-mini" onClick={() => setQty(BODYSHOP_PLAN_KEY, 0)}>Remove</button></div>
              </div>
            </div>
          </div>

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
              <textarea placeholder="Your bodyshop name, city, anything that helps us set up your page" value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <p><b>Total: ${BODYSHOP_PLAN_PRICE.toFixed(2)}/month</b></p>
            <button type="submit" disabled={submitting}>{submitting ? 'Placing…' : 'Place order'}</button>
            {status && <p className="status">{status}</p>}
          </form>
        </div>
      )}
    </div>
  )
}
