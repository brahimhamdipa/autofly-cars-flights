import { useEffect, useMemo, useState } from 'react'
import { supabase, NOTIFY_EMAIL } from '../lib/supabaseClient'
import { Lightbox } from './CarSection'

const CATEGORY_EMOJI = { 'Fresh Fish': '🐟', 'Produce': '🥑', 'Dairy & Eggs': '🥚', 'Bakery': '🍞' }
const money = (n) => `$${Number(n || 0).toFixed(2)}`
const priceOf = (p) => Number(p.sale_price ?? p.price)

function StockLine({ stock }) {
  if (stock <= 0) return <p className="stock out">Out of stock</p>
  if (stock <= 10) return <p className="stock low">Only {stock} left in stock</p>
  return <p className="stock ok">{stock} available in stock</p>
}

function ProductCard({ product, onAdd }) {
  const [qty, setQty] = useState(1)
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const out = product.stock <= 0
  // Multiple pictures per product (DB `images` list; falls back to the
  // legacy single image_url). Slideshow works exactly like the Cars cards.
  const gallery = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product.image_url ? [product.image_url] : [])
  const n = gallery.length
  const safeIdx = n ? idx % n : 0
  return (
    <div className="card g-card">
      <div className="g-photo">
        {n > 0 ? (
          <img src={gallery[safeIdx]} alt={product.name} onClick={() => setZoom(true)} title="Click to enlarge" />
        ) : (
          <span className="g-emoji">{CATEGORY_EMOJI[product.category] || '🛒'}</span>
        )}
        {n > 1 && (
          <>
            <button type="button" className="slide-btn prev" onClick={() => setIdx(i => (i - 1 + n) % n)} aria-label="Previous photo">‹</button>
            <button type="button" className="slide-btn next" onClick={() => setIdx(i => (i + 1) % n)} aria-label="Next photo">›</button>
            <span className="slide-count">{safeIdx + 1} / {n}</span>
          </>
        )}
      </div>
      {zoom && n > 0 && <Lightbox images={gallery} start={safeIdx} onClose={() => setZoom(false)} />}
      <div className="card-body">
        <h3>{product.name}</h3>
        <StockLine stock={product.stock} />
        {product.description && <p className="car-desc">{product.description}</p>}
        <p className="g-price">
          {product.sale_price && <span className="g-was">{money(product.price)}</span>}
          {money(priceOf(product))} <span className="g-unit">/ {product.unit}</span>
        </p>
        <div className="g-buyrow">
          <span className="qty-stepper">
            <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Less">−</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(q => Math.min(product.stock || 1, q + 1))} aria-label="More">+</button>
          </span>
          <button type="button" disabled={out} onClick={() => onAdd(product, qty)}>
            {out ? 'Out of stock' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GroceriesPage() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [cart, setCart] = useState({}) // id -> qty
  const [fulfillment, setFulfillment] = useState('delivery')
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' })
  const [status, setStatus] = useState('')
  const [placed, setPlaced] = useState(null)
  const [placing, setPlacing] = useState(false)

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('grocery_products')
      .select('*')
      .eq('is_available', true)
      .order('sort_order')
      .order('name')
    if (error) setLoadError(error.message)
    else setProducts(data || [])
    setLoading(false)
  }
  useEffect(() => { loadProducts() }, [])

  const byId = useMemo(() => Object.fromEntries(products.map(p => [p.id, p])), [products])
  const cartItems = Object.entries(cart)
    .map(([id, qty]) => ({ product: byId[id], qty }))
    .filter(x => x.product && x.qty > 0)
  const total = cartItems.reduce((s, x) => s + priceOf(x.product) * x.qty, 0)
  const pickupAddresses = [...new Set(cartItems.map(x => x.product.pickup_address).filter(Boolean))]
  const deliveryFrom = [...new Set(cartItems.map(x => x.product.delivery_address).filter(Boolean))]

  const addToCart = (product, qty) =>
    setCart(c => ({ ...c, [product.id]: Math.min(product.stock, (c[product.id] || 0) + qty) }))
  const setQty = (id, qty) =>
    setCart(c => {
      const next = { ...c }
      if (qty <= 0) delete next[id]
      else next[id] = Math.min(byId[id]?.stock ?? qty, qty)
      return next
    })

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
      setPlaced({ id: data.order_id, total: data.total, fulfillment })
      setCart({})
      setStatus('')
      loadProducts() // refresh stock counts under the products
    } catch (err) {
      setStatus('Error: ' + err.message)
      loadProducts()
    }
    setPlacing(false)
  }

  if (placed) {
    return (
      <div>
        <div className="hero-card">
          <h2>✓ Order #{placed.id} received!</h2>
          <p>Thank you — your order total is <b>{money(placed.total)}</b> ({placed.fulfillment}). We've emailed the details to our team and will contact you shortly to confirm {placed.fulfillment === 'delivery' ? 'your delivery' : 'your pickup'} and payment.</p>
          <button onClick={() => setPlaced(null)}>Continue shopping</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="hero-card">
        <span className="tag">Now Open</span>
        <h2>Groceries & fresh fish</h2>
        <p>Fresh groceries and fresh fish in select areas across the US. Add items to your cart, choose delivery or pickup, and send your order — we handle the rest.</p>
      </div>

      {loading && <div className="hero-card"><p>Loading products...</p></div>}
      {loadError && <div className="hero-card"><p>Couldn't load products: {loadError}</p></div>}
      {!loading && !loadError && products.length === 0 && (
        <div className="hero-card"><p>No products yet — check back soon.</p></div>
      )}

      <div className="grid">
        {products.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}
      </div>

      {cartItems.length > 0 && (
        <form className="form-card wide cart-card" onSubmit={placeOrder}>
          <h3>🛒 Your cart</h3>
          {cartItems.map(({ product, qty }) => (
            <div key={product.id} className="cart-row">
              <span className="cart-name">{product.name} <small>({money(priceOf(product))} / {product.unit})</small></span>
              <span className="qty-stepper">
                <button type="button" onClick={() => setQty(product.id, qty - 1)} aria-label="Less">−</button>
                <span>{qty}</span>
                <button type="button" onClick={() => setQty(product.id, qty + 1)} aria-label="More">+</button>
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
      )}
    </div>
  )
}
