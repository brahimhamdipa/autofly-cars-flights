import { useState } from 'react'
import { useBarberCart, BARBER_PLAN_KEY, BARBER_PLAN_NAME, BARBER_PLAN_PRICE } from '../lib/BarberCartContext'
import { insertBarberOrder } from '../lib/barberData'
import { BarbersTopBar } from './BarbersMenu'

// My Cart for barber websites — mirrors GroceryCartPage's shape
// (top bar, hero intro, empty state, cart lines, checkout block at
// the bottom) but for the single $10/month website plan. Placing the
// order inserts a barber_order row and emails the owner, then clears
// the cart; the confirmation survives via lastOrder, same as the
// shopping cart. No payment is taken here — the owner follows up to
// build the barber's page.
export default function BarberCartPage({ go }) {
  const { cart, count, setQty, clearCart, lastOrder, setLastOrder } = useBarberCart()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')

  const inCart = (cart[BARBER_PLAN_KEY] || 0) > 0

  const placeOrder = async (e) => {
    e.preventDefault()
    setSubmitting(true); setStatus('')
    try {
      await insertBarberOrder({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        plan: BARBER_PLAN_NAME,
        price: BARBER_PLAN_PRICE,
        note,
      }, { plan: BARBER_PLAN_NAME, price: BARBER_PLAN_PRICE })
      setLastOrder([{ plan: BARBER_PLAN_NAME, price: BARBER_PLAN_PRICE, customer_name: name }])
      clearCart()
      setName(''); setEmail(''); setPhone(''); setNote('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setSubmitting(false)
  }

  return (
    <div>
      <BarbersTopBar go={go} />
      <div className="hero-card">
        <h2>🛒 My Cart</h2>
        <p>Your barber website order. Place it below and AutoFly will be in touch to build your page with your own logo, services, prices and pictures.</p>
      </div>

      {count === 0 && (!lastOrder || lastOrder.length === 0) && (
        <div className="hero-card">
          <p>Your cart is empty.</p>
          <button onClick={() => go && go('barbers')}>See the barber website</button>
        </div>
      )}

      {lastOrder && lastOrder.length > 0 && (
        <div className="hero-card">
          <h3>✓ Order placed — thank you, {lastOrder[0].customer_name}!</h3>
          <p>{lastOrder[0].plan} — ${Number(lastOrder[0].price).toFixed(2)}/month. AutoFly will be in touch to build your page.</p>
          <button onClick={() => go && go('barbers')}>Back to Barbers</button>
        </div>
      )}

      {inCart && (
        <div>
          <div className="hero-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <b>{BARBER_PLAN_NAME}</b>
                <div className="hint">Your own website + online check-in with wait times + email on every reservation.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b>${BARBER_PLAN_PRICE.toFixed(2)}/month</b>
                <div><button type="button" className="btn-mini" onClick={() => setQty(BARBER_PLAN_KEY, 0)}>Remove</button></div>
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
              <textarea placeholder="Your shop name, city, anything that helps us build your page" value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <p><b>Total: ${BARBER_PLAN_PRICE.toFixed(2)}/month</b></p>
            <button type="submit" disabled={submitting}>{submitting ? 'Placing…' : 'Place order'}</button>
            {status && <p className="status">{status}</p>}
          </form>
        </div>
      )}
    </div>
  )
}
