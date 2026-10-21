import { useMemo, useState } from 'react'
import { supabase, NOTIFY_EMAIL } from '../lib/supabaseClient'
import { useCart } from '../lib/CartContext'

export const money = (n) => `$${Number(n || 0).toFixed(2)}`
export const priceOf = (p) => Number(p.sale_price ?? p.price)

// The "Your cart" section: cart lines, Delivery/Pickup choice (showing the
// per-item addresses stored in the DB), customer details, and placing the
// order (stock-safe RPC + owner email). Used BOTH on the Groceries shop
// page and on the My Cart page so the two never drift apart.
export default function CartCheckout({ products, onOrderPlaced }) {
  const { cart, setQty, clearCart, lastOrder, setLastOrder } = useCart()
  const [fulfillment, setFulfillment] = useState('delivery')
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' })
  const [status, setStatus] = useState('')
  const [placing, setPlacing] = useState(false)

  const byId = useMemo(() => Object.fromEntries((products || []).map(p => [p.id, p])), [products])
  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ product: byId[id], qty }))
    .filter(x => x.product && x.qty > 0)
  const total = cartItems.reduce((s, x) => s + priceOf(x.product) * x.qty, 0)
  const pickupAddresses = [...new Set(cartItems.map(x => x.product.pickup_address).filter(Boolean))]
  const deliveryFrom = [...new Set(cartItems.map(x => x.product.delivery_address).filter(Boolean))]

  const placeOrder = async (e) => {
    e.preventDefault()
    if (cartItems.length === 0) return
    if (fulfillment === 'delivery' && !customer.address.trim()) {
      setStatus('Please enter your delivery address.')
      return
    }
    setPlacing(true)
    setStatus('Placing your order...')
    try {
      const { data, error } = await supabase.rpc('place_grocery_order', {
        p_customer_name: customer.name,
        p_customer_email: customer.email,
        p_customer_phone: customer.phone,
        p_fulfillment: fulfillment,
        p_delivery_address: fulfillment === 'delivery' ? customer.address : '',
        p_items: cartItems.map(x => ({ id: x.product.id, qty: x.qty })),
      })
      if (error) throw error
      // Email the owner the full order (same as every other form on the site).
      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            to: NOTIFY_EMAIL,
            subject: `New grocery order #${data.order_id} — ${money(data.total)}`,
            table: 'grocery_orders',
            record: {
              order_id: data.order_id,
              customer_name: customer.name,
              customer_email: customer.email,
              customer_phone: customer.phone,
              fulfillment,
              delivery_address: fulfillment === 'delivery' ? customer.address : '',
              items: data.items,
              total: data.total,
            },
          },
        })
      } catch (mailErr) {
        console.warn('Order email failed:', mailErr.message)
      }
      setLastOrder({ id: data.order_id, total: data.total, fulfillment })
      clearCart()
      setStatus('')
      if (onOrderPlaced) onOrderPlaced() // refresh product stock counts
    } catch (err) {
      setStatus('Error: ' + err.message)
      if (onOrderPlaced) onOrderPlaced()
    }
    setPlacing(false)
  }

  if (lastOrder) {
    return (
      <div className="hero-card">
        <h2>✓ Order #{lastOrder.id} received!</h2>
        <p>Thank you — your order total is <b>{money(lastOrder.total)}</b> ({lastOrder.fulfillment}). We've emailed the details to our team and will contact you shortly to confirm {lastOrder.fulfillment === 'delivery' ? 'your delivery' : 'your pickup'} and payment.</p>
        <button onClick={() => setLastOrder(null)}>Continue shopping</button>
      </div>
    )
  }

  if (cartItems.length === 0) return null

  return (
    <form className="form-card wide cart-card" onSubmit={placeOrder}>
      <h3>🛒 Your cart</h3>
      {cartItems.map(({ product, qty }) => (
        <div key={product.id} className="cart-row">
          <span className="cart-name">{product.name} <small>({money(priceOf(product))} / {product.unit})</small></span>
          <span className="qty-stepper">
            <button type="button" onClick={() => setQty(product.id, qty - 1, product.stock)} aria-label="Less">−</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(product.id, qty + 1, product.stock)} aria-label="More">+</button>
          </span>
          <span className="cart-line-total">{money(priceOf(product) * qty)}</span>
          <button type="button" className="cart-remove" onClick={() => setQty(product.id, 0)}>Remove</button>
        </div>
      ))}
      <p className="cart-total">Total: <b>{money(total)}</b></p>

      <div className="trip-tabs fulfill-tabs">
        <button type="button" className={fulfillment === 'delivery' ? 'active' : ''} onClick={() => setFulfillment('delivery')}>🚚 Delivery</button>
        <button type="button" className={fulfillment === 'pickup' ? 'active' : ''} onClick={() => setFulfillment('pickup')}>🏪 Pickup</button>
      </div>

      {fulfillment === 'pickup' && pickupAddresses.length > 0 && (
        <div className="addr-box">
          <b>Pickup address{pickupAddresses.length > 1 ? 'es' : ''}:</b>
          {pickupAddresses.map(a => <p key={a}>📍 {a}</p>)}
        </div>
      )}
      {fulfillment === 'delivery' && (
        <>
          {deliveryFrom.length > 0 && (
            <div className="addr-box">
              <b>Your order ships from:</b>
              {deliveryFrom.map(a => <p key={a}>📍 {a}</p>)}
            </div>
          )}
          <textarea required placeholder="Your delivery address" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} />
        </>
      )}

      <div className="row">
        <input required placeholder="Your name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
        <input required placeholder="Email" type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
      </div>
      <input placeholder="Phone" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
      <button type="submit" disabled={placing}>{placing ? 'Placing order...' : `Place order — ${money(total)}`}</button>
      {status && <p className="status">{status}</p>}
    </form>
  )
}
