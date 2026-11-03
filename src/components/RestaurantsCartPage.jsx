import { useState } from 'react'
import { useRestaurantCart, RESTAURANT_PLAN_KEY, RESTAURANT_PLAN_NAME, RESTAURANT_PLAN_PRICE } from '../lib/RestaurantCartContext'
import { insertRestaurantOrder } from '../lib/restaurantData'
import { RestaurantsTopBar } from './RestaurantsMenu'

// My Cart for restaurant ordering pages — mirrors BarberCartPage's
// shape (top bar, hero intro, empty state, cart lines, checkout block
// at the bottom) but for the single $20/month ordering-page plan.
// Placing the order inserts a restaurant_order row and emails the
// owner, then clears the cart; the confirmation survives via
// lastOrder, same as the barber cart. No payment is taken here — the
// owner follows up to set the restaurant up. Connecting carts to the
// bank comes later.
export default function RestaurantsCartPage({ go }) {
  const { cart, count, setQty, clearCart, lastOrder, setLastOrder } = useRestaurantCart()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')

  const inCart = (cart[RESTAURANT_PLAN_KEY] || 0) > 0

  const placeOrder = async (e) => {
    e.preventDefault()
    setSubmitting(true); setStatus('')
    try {
      await insertRestaurantOrder({
        customer_name: name,
        customer_email: email,
        customer_phone: phone,
        plan: RESTAURANT_PLAN_NAME,
        price: RESTAURANT_PLAN_PRICE,
        note,
      }, { plan: RESTAURANT_PLAN_NAME, price: RESTAURANT_PLAN_PRICE })
      setLastOrder([{ plan: RESTAURANT_PLAN_NAME, price: RESTAURANT_PLAN_PRICE, customer_name: name }])
      clearCart()
      setName(''); setEmail(''); setPhone(''); setNote('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setSubmitting(false)
  }

  return (
    <div>
      <RestaurantsTopBar go={go} />
      <div className="hero-card">
        <h2>🛒 My Cart</h2>
        <p>Your restaurant ordering page order. Place it below and AutoFly will be in touch to set up your restaurant with your own link, login, menu and live kitchen.</p>
      </div>

      {count === 0 && (!lastOrder || lastOrder.length === 0) && (
        <div className="hero-card">
          <p>Your cart is empty.</p>
          <button onClick={() => go && go('restaurants')}>See the restaurant ordering page</button>
        </div>
      )}

      {lastOrder && lastOrder.length > 0 && (
        <div className="hero-card">
          <h3>✓ Order placed — thank you, {lastOrder[0].customer_name}!</h3>
          <p>{lastOrder[0].plan} — ${Number(lastOrder[0].price).toFixed(2)}/month. AutoFly will be in touch to set up your restaurant.</p>
          <button onClick={() => go && go('restaurants')}>Back to Restaurants</button>
        </div>
      )}

      {inCart && (
        <div>
          <div className="hero-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <b>{RESTAURANT_PLAN_NAME}</b>
                <div className="hint">Your own ordering page + live kitchen screen + menu changes, for your restaurant.</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <b>${RESTAURANT_PLAN_PRICE.toFixed(2)}/month</b>
                <div><button type="button" className="btn-mini" onClick={() => setQty(RESTAURANT_PLAN_KEY, 0)}>Remove</button></div>
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
              <textarea placeholder="Your restaurant name, city, anything that helps us set up your page" value={note} onChange={e => setNote(e.target.value)} />
            </label>
            <p><b>Total: ${RESTAURANT_PLAN_PRICE.toFixed(2)}/month</b></p>
            <button type="submit" disabled={submitting}>{submitting ? 'Placing…' : 'Place order'}</button>
            {status && <p className="status">{status}</p>}
          </form>
        </div>
      )}
    </div>
  )
}
