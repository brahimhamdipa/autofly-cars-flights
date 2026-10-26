import { useEffect, useMemo, useState } from 'react'
import { Lightbox } from './CarSection'
import { GroceryTopBar } from './GroceryMenu'
import {
  loadProvider, loadItems, placeStoreOrder, placeStoreHold,
  emailReceipt, buildReceiptPdf, money,
} from '../lib/storeData'

// "Order from us" page for one store: only this provider's items in the
// "Store products" category. The cart here belongs to THIS provider only
// (localStorage key includes the provider ID) — it never mixes with the
// Online Store cart or another store's cart.
const cartKey = (providerId) => `autofly-store-cart-${providerId}`

function ItemCard({ item, onAdd, onHold }) {
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const images = item.pics || []
  const n = images.length
  return (
    <div className="card">
      <div className="slideshow">
        {n > 0 ? (
          <img src={images[idx]} alt={item.name} onClick={() => setZoom(true)} title="Click to enlarge" />
        ) : (
          <div className="no-photo">No photos yet</div>
        )}
        {n > 1 && (
          <>
            <button className="slide-btn prev" onClick={() => setIdx(i => (i - 1 + n) % n)} aria-label="Previous photo">‹</button>
            <button className="slide-btn next" onClick={() => setIdx(i => (i + 1) % n)} aria-label="Next photo">›</button>
            <span className="slide-count">{idx + 1} / {n}</span>
          </>
        )}
      </div>
      <div className="card-body">
        <h3>{item.name}</h3>
        <p className="price">{money(item.price)}</p>
        {item.description && <p className="car-desc">{item.description}</p>}
        <p className="item-badges">
          {item.delivery && <span className="badge">🚚 Delivery</span>}
          {item.pickup && <span className="badge">🏪 Pickup</span>}
        </p>
        <div className="item-actions">
          <button onClick={() => onAdd(item)}>Add to cart</button>
          <button className="btn-soft" onClick={() => onHold(item)}>Hold the item</button>
        </div>
      </div>
      {zoom && n > 0 && <Lightbox images={images} start={idx} onClose={() => setZoom(false)} />}
    </div>
  )
}

export default function StoreOrderPage({ providerId, go }) {
  const [provider, setProvider] = useState(null)
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem(cartKey(providerId)) || '[]') } catch { return [] }
  })
  const [fulfillment, setFulfillment] = useState('delivery')
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' })
  const [status, setStatus] = useState('')
  const [receipt, setReceipt] = useState(null)
  const [holdItem, setHoldItem] = useState(null)
  const [holdForm, setHoldForm] = useState({ name: '', email: '', phone: '' })
  const [holdStatus, setHoldStatus] = useState('')
  const [holdReceipt, setHoldReceipt] = useState(null)

  useEffect(() => {
    setProvider(null); setItems(null); setError(''); setReceipt(null); setHoldReceipt(null)
    try { setCart(JSON.parse(localStorage.getItem(cartKey(providerId)) || '[]')) } catch { setCart([]) }
    loadProvider(providerId).then(setProvider).catch(e => setError(e.message))
    loadItems({ providerId, categorySlug: 'store-products' }).then(setItems).catch(e => setError(e.message))
  }, [providerId])

  useEffect(() => {
    try { localStorage.setItem(cartKey(providerId), JSON.stringify(cart)) } catch { /* ignore */ }
  }, [cart, providerId])

  const itemById = useMemo(() => Object.fromEntries((items || []).map(i => [i.id, i])), [items])
  const cartLines = cart.map(c => ({ ...itemById[c.id], qty: c.qty })).filter(c => c.name)
  const cartTotal = cartLines.reduce((s, c) => s + Number(c.price || 0) * c.qty, 0)
  const canDeliver = cartLines.length > 0 && cartLines.every(c => c.delivery)
  const canPickup = cartLines.length > 0 && cartLines.every(c => c.pickup)
  // Keep the chosen fulfillment valid as the cart changes.
  useEffect(() => {
    if (fulfillment === 'delivery' && !canDeliver && canPickup) setFulfillment('pickup')
    if (fulfillment === 'pickup' && !canPickup && canDeliver) setFulfillment('delivery')
  }, [canDeliver, canPickup, fulfillment])
  const fulfillmentOk = fulfillment === 'delivery' ? canDeliver : canPickup

  const filtered = useMemo(() => {
    if (!items) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter(i =>
      [i.name, i.description, String(i.price), i.provider?.name, i.provider?.country]
        .join(' ').toLowerCase().includes(needle)
    )
  }, [items, query])

  const addToCart = (item) => {
    setCart(c => {
      const found = c.find(x => x.id === item.id)
      return found ? c.map(x => x.id === item.id ? { ...x, qty: x.qty + 1 } : x) : [...c, { id: item.id, qty: 1 }]
    })
  }
  const setQty = (id, qty) => {
    setCart(c => qty < 1 ? c.filter(x => x.id !== id) : c.map(x => x.id === id ? { ...x, qty } : x))
  }

  const submitOrder = async (e) => {
    e.preventDefault()
    if (!fulfillmentOk) { setStatus('That fulfillment option is not available for everything in your cart.'); return }
    setStatus('Placing your order...')
    try {
      const res = await placeStoreOrder({
        providerId, name: form.name, email: form.email, phone: form.phone,
        fulfillment, deliveryAddress: form.address,
        cart: cartLines.map(c => ({ id: c.id, qty: c.qty })),
      })
      const pdf = buildReceiptPdf({
        kind: 'order', refId: res.order_id, storeName: provider.name,
        customer: form, lines: res.items, total: res.total,
        fulfillment, deliveryAddress: form.address,
      })
      const record = {
        order_id: res.order_id, store: provider.name, customer: form.name,
        customer_email: form.email, customer_phone: form.phone,
        fulfillment, delivery_address: form.address, items: res.items, total: res.total,
      }
      try {
        await emailReceipt({ subject: `New store order #${res.order_id} — ${provider.name}`, record, pdfBase64: pdf.base64, filename: `receipt-order-${res.order_id}.pdf` })
      } catch { /* order is saved; email retry is a bonus */ }
      setReceipt({ ...res, pdf, record })
      setCart([])
      setStatus('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  const submitHold = async (e) => {
    e.preventDefault()
    setHoldStatus('Holding...')
    try {
      const res = await placeStoreHold({ itemId: holdItem.id, ...holdForm })
      const pdf = buildReceiptPdf({
        kind: 'hold', refId: res.hold_id, storeName: provider.name,
        customer: holdForm, lines: [{ name: res.item, price: res.price, qty: 1 }], total: res.price,
      })
      const record = {
        hold_id: res.hold_id, store: provider.name, item: res.item, price: res.price,
        customer: holdForm.name, customer_email: holdForm.email, customer_phone: holdForm.phone,
      }
      try {
        await emailReceipt({ subject: `New hold #${res.hold_id} — ${res.item} (${provider.name})`, record, pdfBase64: pdf.base64, filename: `receipt-hold-${res.hold_id}.pdf` })
      } catch { /* hold is saved */ }
      setHoldReceipt({ ...res, pdf, record })
      setHoldStatus('')
    } catch (err) {
      setHoldStatus('Error: ' + err.message)
    }
  }

  const resendReceipt = async (r, kind) => {
    const ref = kind === 'hold' ? r.hold_id : r.order_id
    await emailReceipt({
      subject: `Receipt ${kind} #${ref} — ${provider.name}`,
      record: r.record, pdfBase64: r.pdf.base64,
      filename: `receipt-${kind}-${ref}.pdf`,
    })
    alert('Receipt emailed to the store owner.')
  }

  return (
    <div>
      <GroceryTopBar go={go} />

      <div className="hero-card">
        <button className="link-btn" onClick={() => go('store-detail', providerId)}>← Back to {provider ? provider.name : 'store'}</button>
        <h2>🛒 Order from {provider ? provider.name : 'this store'}</h2>
        <p>Everything below is from this store only — your cart here never mixes with the Online Store or another store.</p>
        <div className="filters">
          <input placeholder="Search items (e.g. bread, 8.50)" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="hero-card"><p>Couldn't load items: {error}. If the store tables are not set up yet, run <b>supabase/store-tables.sql</b> in the Supabase SQL editor.</p></div>
      )}
      {!error && items === null && <div className="hero-card"><p>Loading items...</p></div>}

      {receipt && (
        <div className="hero-card receipt">
          <h3>✓ Order #{receipt.order_id} placed — thank you!</h3>
          <p>Total: <b>{money(receipt.total)}</b> · {fulfillment}{receipt.record.delivery_address ? ` · ${receipt.record.delivery_address}` : ''}</p>
          <div className="store-actions">
            <button onClick={() => receipt.pdf.download(`receipt-order-${receipt.order_id}.pdf`)}>⬇️ Download receipt</button>
            <button className="btn-soft" onClick={() => resendReceipt(receipt, 'order')}>✉️ Email receipt</button>
            <button className="btn-soft" onClick={() => setReceipt(null)}>Continue shopping</button>
          </div>
        </div>
      )}

      {holdReceipt && (
        <div className="hero-card receipt">
          <h3>✓ Held! Hold #{holdReceipt.hold_id} — {holdReceipt.item}</h3>
          <p>The store is holding this item for you until you contact them to arrange pickup or delivery. No payment was taken online — you pay the store when you make your arrangement.</p>
          <div className="store-actions">
            <button onClick={() => holdReceipt.pdf.download(`receipt-hold-${holdReceipt.hold_id}.pdf`)}>⬇️ Download receipt</button>
            <button className="btn-soft" onClick={() => resendReceipt(holdReceipt, 'hold')}>✉️ Email receipt</button>
            <button className="btn-soft" onClick={() => setHoldReceipt(null)}>Done</button>
          </div>
        </div>
      )}

      {!error && items && filtered.length === 0 && (
        <div className="hero-card"><p>No items match. This store has no "Store products" items yet — add some from Admin.</p></div>
      )}

      <div className="grid">
        {filtered.map(item => (
          <ItemCard key={item.id} item={item} onAdd={addToCart} onHold={setHoldItem} />
        ))}
      </div>

      {cartLines.length > 0 && !receipt && (
        <div className="form-card wide store-cart">
          <h3>Your cart — {provider?.name}</h3>
          {cartLines.map(c => (
            <div className="cart-line" key={c.id}>
              <span>{c.name} — {money(c.price)}</span>
              <span>
                <button type="button" className="btn-mini" onClick={() => setQty(c.id, c.qty - 1)}>−</button>
                {' '}{c.qty}{' '}
                <button type="button" className="btn-mini" onClick={() => setQty(c.id, c.qty + 1)}>+</button>
              </span>
              <span>{money(c.price * c.qty)}</span>
            </div>
          ))}
          <p><b>Total: {money(cartTotal)}</b></p>
          <form onSubmit={submitOrder}>
            <div className="trip-tabs">
              {canDeliver && <button type="button" className={fulfillment === 'delivery' ? 'active' : ''} onClick={() => setFulfillment('delivery')}>🚚 Delivery</button>}
              {canPickup && <button type="button" className={fulfillment === 'pickup' ? 'active' : ''} onClick={() => setFulfillment('pickup')}>🏪 Pickup</button>}
            </div>
            {!canDeliver && !canPickup && <p className="hint">Nothing in your cart supports delivery or pickup — remove those items to continue.</p>}
            <input required placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Phone" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            {fulfillment === 'delivery' && <input required placeholder="Delivery address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />}
            <button type="submit" disabled={!fulfillmentOk}>Place order — {money(cartTotal)}</button>
            {status && <p className="hint">{status}</p>}
          </form>
        </div>
      )}

      {holdItem && !holdReceipt && (
        <div className="modal-overlay" onClick={() => setHoldItem(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setHoldItem(null)} aria-label="Close">✕</button>
            <form onSubmit={submitHold} className="modal-form">
              <h3>Hold — {holdItem.name} ({money(holdItem.price)})</h3>
              <p className="hint">The store will hold this item for you until you contact them to arrange pickup or delivery. No payment is taken online.</p>
              <input required placeholder="Name" value={holdForm.name} onChange={e => setHoldForm({ ...holdForm, name: e.target.value })} />
              <input required placeholder="Email" type="email" value={holdForm.email} onChange={e => setHoldForm({ ...holdForm, email: e.target.value })} />
              <input placeholder="Phone" type="tel" value={holdForm.phone} onChange={e => setHoldForm({ ...holdForm, phone: e.target.value })} />
              <button type="submit">Hold this item</button>
              {holdStatus && <p className="hint">{holdStatus}</p>}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
