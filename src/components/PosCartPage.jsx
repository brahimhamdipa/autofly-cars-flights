import { useState } from 'react'
import { usePosCart, POS_PLAN_KEY, POS_PLAN_NAME, POS_PLAN_PRICE } from '../lib/PosCartContext'
import { insertPosOrder } from '../lib/posData'
import { PosTopBar } from './PosMenu'

// My Cart for point-of-sale pages — mirrors RestaurantsCartPage's
// shape (top bar, hero intro, empty state, cart lines, checkout block
// at the bottom) but for the single $29/month point-of-sale plan.
// Placing the order inserts a pos_order row and emails the owner,
// then clears the cart; the confirmation survives via lastOrder,
// same as the restaurant cart. No payment is taken here — the owner
// follows up to set the store up. Connecting carts to the bank
// comes later.
export default function PosCartPage({ go }) {
  const { cart, count, setQty, clearCart, lastOrder, setLastOrder } = usePosCart()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')

  const inCart = (cart[POS_PLAN_KEY] || 0) > 0

  const placeOrder = async (e) => {
    e.preventDefault()
    setSubmitting(true); setStatus('')
    try {
      await insertPosOrder({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        plan: POS_PLAN_NAME,
        price: POS_PLAN_PRICE,
        note,
      }, { plan: POS_PLAN_NAME, price: POS_PLAN_PRICE })
      setLastOrder([{ plan: POS_PLAN_NAME, price: POS_PLAN_PRICE, customer_name: name }])
      clearCart()
      setName(''); setEmail(''); setPhone(''); setNote('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setSubmitting(false)
  }

  return (
    <div>
      <PosTopBar go={go} />
      <div className="hero-card">
        <h2>🛒 My Cart</h2>
        <p>Your point of sale order. Place it below and AutoFly will be in touch to set up your store with your own link, login, items and receipts.</p>
      </div>

      {count === 0 && (!lastOrder || lastOrder.length === 0) && (
        <div className="hero-card">
          <p>Your cart is empty.</p>
          <button onClick={() => go && go('pos')}>See the point of sale page</button>
        </div>
      )}

      {lastOrder && lastOrder.length > 0 && (
        <div className="hero-card">
          <h3>✓ Order placed — thank you, {lastOrder[0].customer_name}!</h3>
          <p>{lastOrder[0].plan} — ${Number(lastOrder[0].price).toFixed(2)}/month. AutoFly will be in touch to set up your point of sale.</p>
          <button onClick={() => go && go('pos')}>Back to Point of Sale</button>
        </div>
      )}

      {inCart && (
        <div>
          <div className="hero-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <b>{POS_PLAN_NAME}</b>
                <div className="hint">Your own register page + live stock + receipts, for your store.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b>${POS_PLAN_PRICE.toFixed(2)}/month</b>
                <div><button type="button" className="btn-mini" onClick={() => setQty(POS_PLAN_KEY, 0)}>Remove</button></div>
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
              <textarea placeholder="Your store name, city, anything that helps us set up your register" value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <p><b>Total: ${POS_PLAN_PRICE.toFixed(2)}/month</b></p>
            <button type="submit" disabled={submitting}>{submitting ? 'Placing…' : 'Place order'}</button>
            {status && <p className="status">{status}</p>}
          </form>
        </div>
      )}
    </div>
  )
}
