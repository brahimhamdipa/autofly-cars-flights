import { useState } from 'react'
import { useDealerCart, DEALER_PLAN_KEY, DEALER_PLAN_NAME, DEALER_PLAN_PRICE } from '../lib/DealerCartContext'
import { insertDealerOrder } from '../lib/dealerData'
import { DealerTopBar } from './DealerMenu'

// My Cart for dealer websites — mirrors RestaurantsCartPage's
// shape (top bar, hero intro, empty state, cart lines, checkout block
// at the bottom) but for the single $20/month dealer-website plan.
// Placing the order inserts a dealer_order row and emails the
// owner, then clears the cart; the confirmation survives via
// lastOrder, same as the restaurant cart. No payment is taken here — the
// owner follows up to set the dealership up. Connecting carts to the
// bank comes later.
export default function DealerCartPage({ go }) {
  const { cart, count, setQty, clearCart, lastOrder, setLastOrder } = useDealerCart()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')

  const inCart = (cart[DEALER_PLAN_KEY] || 0) > 0

  const placeOrder = async (e) => {
    e.preventDefault()
    setSubmitting(true); setStatus('')
    try {
      await insertDealerOrder({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        plan: DEALER_PLAN_NAME,
        price: DEALER_PLAN_PRICE,
        note,
      }, { plan: DEALER_PLAN_NAME, price: DEALER_PLAN_PRICE })
      setLastOrder([{ plan: DEALER_PLAN_NAME, price: DEALER_PLAN_PRICE, customer_name: name }])
      clearCart()
      setName(''); setEmail(''); setPhone(''); setNote('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setSubmitting(false)
  }

  return (
    <div>
      <DealerTopBar go={go} />
      <div className="hero-card">
        <h2>🛒 My Cart</h2>
        <p>Your dealer website order. Place it below and AutoFly will be in touch to set up your dealership with your own link, login, vehicles and bookings.</p>
      </div>

      {count === 0 && (!lastOrder || lastOrder.length === 0) && (
        <div className="hero-card">
          <p>Your cart is empty.</p>
          <button onClick={() => go && go('dealer')}>See the dealer website</button>
        </div>
      )}

      {lastOrder && lastOrder.length > 0 && (
        <div className="hero-card">
          <h3>✓ Order placed — thank you, {lastOrder[0].customer_name}!</h3>
          <p>{lastOrder[0].plan} — ${Number(lastOrder[0].price).toFixed(2)}/month. AutoFly will be in touch to set up your dealership.</p>
          <button onClick={() => go && go('dealer')}>Back to Dealer</button>
        </div>
      )}

      {inCart && (
        <div>
          <div className="hero-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <b>{DEALER_PLAN_NAME}</b>
                <div className="hint">Your own dealer page + test drives, trade-ins and finance calculator, for your dealership.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b>${DEALER_PLAN_PRICE.toFixed(2)}/month</b>
                <div><button type="button" className="btn-mini" onClick={() => setQty(DEALER_PLAN_KEY, 0)}>Remove</button></div>
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
              <textarea placeholder="Your dealership name, city, anything that helps us set up your page" value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <p><b>Total: ${DEALER_PLAN_PRICE.toFixed(2)}/month</b></p>
            <button type="submit" disabled={submitting}>{submitting ? 'Placing…' : 'Place order'}</button>
            {status && <p className="status">{status}</p>}
          </form>
        </div>
      )}
    </div>
  )
}
