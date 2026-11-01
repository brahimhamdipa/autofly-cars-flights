import { useEffect, useMemo, useState } from 'react'
import { supabase, NOTIFY_EMAIL } from '../lib/supabaseClient'
import { useCart } from '../lib/CartContext'
import { loadItemsByIds, loadProviders, loadItemLocations, placeStoreOrder, placeStoreHoldOrder, emailReceipt, buildReceiptPdf, money } from '../lib/storeData'

export { money }
export const priceOf = (p) => Number(p.sale_price ?? p.price)

// The unified "Your cart" section: EVERYTHING the customer added —
// grocery products and store items alike — grouped into sections, one
// per store (plus an "Online Store" section for grocery products). Each
// section has its own lines, totals, Delivery/Pickup choice and its own
// "Place order" button, because each store's order is placed separately
// (and each store's items only offer the fulfillment they support).
// Used BOTH on the Groceries shop page and on the My Cart page so the
// two never drift apart.
export default function CartCheckout({ products, onOrderPlaced }) {
  const { cart, setQty, removeSection, lastOrder, setLastOrder } = useCart()
  const [customer, setCustomer] = useState({ name: '', email: '', phone: '', address: '' })
  const [chosen, setChosen] = useState({}) // sectionKey -> 'delivery' | 'pickup' (nothing chosen by default)
  const [placing, setPlacing] = useState({})
  const [sectionStatus, setSectionStatus] = useState({})
  const [storeItems, setStoreItems] = useState([])
  const [providers, setProviders] = useState([])
  // Linked delivery/pickup locations per store item, for the popups:
  // { fromdel: { itemId: [rows] }, topick: { itemId: [rows] } }.
  const [itemLocs, setItemLocs] = useState({ fromdel: {}, topick: {} })
  // sectionKey -> { mode, label } once a popup location is picked.
  const [selectedLoc, setSelectedLoc] = useState({})
  // Open popup: { sectionKey, mode, rows } or null. Search text for it.
  const [popup, setPopup] = useState(null)
  const [popupQuery, setPopupQuery] = useState('')

  // The cart reads each store's order-mode flags: holdorder shows the
  // gray Hold button, payorder shows the blue Place-order button.
  useEffect(() => {
    loadProviders().then(setProviders).catch(() => {})
  }, [])
  const providerFlags = useMemo(
    () => Object.fromEntries(providers.map(p => [p.id, { holdorder: !!p.holdorder, payorder: p.payorder !== false }])),
    [providers]
  )

  const groceryById = useMemo(() => Object.fromEntries((products || []).map(p => [p.id, p])), [products])

  const groceryLines = Object.entries(cart)
    .filter(([k]) => k.startsWith('g:'))
    .map(([k, qty]) => ({ key: k, product: groceryById[k.slice(2)], qty }))
    .filter(x => x.product && x.qty > 0)

  const storeIds = useMemo(
    () => Object.keys(cart).filter(k => k.startsWith('s:')).map(k => Number(k.slice(2))),
    [cart]
  )
  useEffect(() => {
    if (storeIds.length === 0) { setStoreItems([]); return }
    let alive = true
    loadItemsByIds(storeIds).then(data => { if (alive) setStoreItems(data) }).catch(() => {})
    return () => { alive = false }
  }, [storeIds.join(',')])

  const storeById = useMemo(() => Object.fromEntries(storeItems.map(i => [i.id, i])), [storeItems])
  const storeLines = Object.entries(cart)
    .filter(([k]) => k.startsWith('s:'))
    .map(([k, qty]) => ({ key: k, item: storeById[Number(k.slice(2))], qty }))
    .filter(x => x.item && x.qty > 0)

  // Sections: grocery first, then one per store, in cart order.
  const sections = useMemo(() => {
    const out = []
    if (groceryLines.length > 0) {
      out.push({
        key: 'grocery', kind: 'grocery', title: 'Online Store', providerId: null,
        lines: groceryLines.map(l => ({
          key: l.key, name: l.product.name, unit: l.product.unit,
          price: priceOf(l.product), qty: l.qty, stock: l.product.stock,
          delivery: true, pickup: true,
          delivery_address: l.product.delivery_address, pickup_address: l.product.pickup_address,
        })),
      })
    }
    const byProvider = {}
    for (const l of storeLines) {
      const pid = l.item.provider_id
      if (!byProvider[pid]) {
        byProvider[pid] = {
          key: 'store-' + pid, kind: 'store', title: l.item.provider?.name || 'Store', providerId: pid, lines: [],
        }
        out.push(byProvider[pid])
      }
      byProvider[pid].lines.push({
        key: l.key, name: l.item.name, unit: null,
        price: Number(l.item.price), qty: l.qty, stock: l.item.stock,
        delivery: l.item.delivery, pickup: l.item.pickup,
        delivery_address: l.item.delivery_address, pickup_address: l.item.pickup_address,
      })
    }
    return out
  }, [groceryLines, storeLines])

  // Locations for every store item currently in the cart.
  const cartStoreItemIds = useMemo(
    () => sections.filter(s => s.kind === 'store').flatMap(s => s.lines.map(l => Number(l.key.slice(2)))),
    [sections]
  )
  useEffect(() => {
    if (cartStoreItemIds.length === 0) { setItemLocs({ fromdel: {}, topick: {} }); return }
    let alive = true
    loadItemLocations(cartStoreItemIds).then(d => { if (alive) setItemLocs(d) }).catch(() => {})
    return () => { alive = false }
  }, [cartStoreItemIds.join(',')])

  // No default fulfillment: null until the customer picks a mode the
  // section's lines all support.
  const effFulfillment = (section) => {
    const canDeliver = section.lines.every(l => l.delivery)
    const canPickup = section.lines.every(l => l.pickup)
    const want = chosen[section.key]
    if (want === 'delivery' && canDeliver) return 'delivery'
    if (want === 'pickup' && canPickup) return 'pickup'
    return null
  }

  // One-line display of a location row, as listed in the popup.
  const locDisplay = (row, mode) => mode === 'delivery'
    ? [row.fname, row.faddress, row.fcity, row.fstate, row.fzip, row.fcountry].filter(Boolean).join(', ')
    : [row.tname, row.taddress, row.tcity, row.tstate, row.tzip, row.tcountry].filter(Boolean).join(', ')

  // Popup rows for a section + mode, or null when the button should
  // just select the mode (no linked locations, or no location shared
  // by every constrained item). Items with no links don't narrow it
  // down: only items that HAVE links take part in the intersection.
  const popupCandidates = (section, mode) => {
    const map = mode === 'delivery' ? itemLocs.fromdel : itemLocs.topick
    const perItem = section.lines.map(l => map[Number(l.key.slice(2))] || [])
    const constrained = perItem.filter(a => a.length > 0)
    if (constrained.length === 0) return null
    const idSets = constrained.map(a => new Set(a.map(r => r.id)))
    const common = new Set([...idSets[0]].filter(id => idSets.every(s => s.has(id))))
    if (common.size === 0) return null
    const seen = new Set()
    const rows = []
    for (const a of constrained) for (const r of a) {
      if (common.has(r.id) && !seen.has(r.id)) { seen.add(r.id); rows.push(r) }
    }
    return rows
  }

  const handleFulfillClick = (section, mode) => {
    const rows = popupCandidates(section, mode)
    setChosen(c => ({ ...c, [section.key]: mode }))
    setSectionStatus(s => ({ ...s, [section.key]: '' }))
    if (rows) { setPopup({ sectionKey: section.key, mode, rows }); setPopupQuery('') }
  }

  // Grocery sections have no popups: picking a mode just selects it
  // (and clears any stale notice from an earlier Place attempt).
  const handleGroceryClick = (section, mode) => {
    setChosen(c => ({ ...c, [section.key]: mode }))
    setSectionStatus(s => ({ ...s, [section.key]: '' }))
  }

  // X closes the popup with no half-state: the mode choice goes back
  // to unselected, and any picked location for the section is dropped.
  const closePopup = () => {
    if (popup) {
      const key = popup.sectionKey
      setChosen(c => { const n = { ...c }; delete n[key]; return n })
      setSelectedLoc(s => { const n = { ...s }; delete n[key]; return n })
    }
    setPopup(null)
  }

  const selectPopupRow = (row) => {
    if (!popup) return
    setSelectedLoc(s => ({ ...s, [popup.sectionKey]: { mode: popup.mode, label: locDisplay(row, popup.mode) } }))
    setPopup(null)
  }

  // Forget a section's fulfillment choice + picked location (used after
  // a successful place/hold, alongside removeSection).
  const clearSectionChoice = (key) => {
    setChosen(c => { const n = { ...c }; delete n[key]; return n })
    setSelectedLoc(s => { const n = { ...s }; delete n[key]; return n })
  }

  const placeGrocery = async (section) => {
    const fulfillment = effFulfillment(section)
    if (!fulfillment) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Please choose Delivery or Pickup first.' }))
      return
    }
    if (!customer.name.trim() || !customer.email.trim()) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Please enter your name and email.' }))
      return
    }
    if (fulfillment === 'delivery' && !customer.address.trim()) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Please enter your delivery address.' }))
      return
    }
    setPlacing(p => ({ ...p, [section.key]: true }))
    setSectionStatus(s => ({ ...s, [section.key]: 'Placing your order...' }))
    try {
      const { data, error } = await supabase.rpc('place_grocery_order', {
        p_customer_name: customer.name,
        p_customer_email: customer.email,
        p_customer_phone: customer.phone,
        p_fulfillment: fulfillment,
        p_delivery_address: fulfillment === 'delivery' ? customer.address : '',
        p_items: section.lines.map(l => ({ id: Number(l.key.slice(2)), qty: l.qty })),
      })
      if (error) throw error
      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            to: NOTIFY_EMAIL,
            subject: `New grocery order #${data.order_id} — ${money(data.total)}`,
            table: 'grocery_orders',
            record: {
              order_id: data.order_id, customer_name: customer.name, customer_email: customer.email,
              customer_phone: customer.phone, fulfillment,
              delivery_address: fulfillment === 'delivery' ? customer.address : '',
              items: data.items, total: data.total,
            },
          },
        })
      } catch (mailErr) {
        console.warn('Order email failed:', mailErr.message)
      }
      setLastOrder(prev => [...(prev || []), { kind: 'grocery', id: data.order_id, total: data.total, fulfillment }])
      removeSection(section.lines.map(l => l.key))
      clearSectionChoice(section.key)
      setSectionStatus(s => ({ ...s, [section.key]: '' }))
      if (onOrderPlaced) onOrderPlaced()
    } catch (err) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Error: ' + err.message }))
      if (onOrderPlaced) onOrderPlaced()
    }
    setPlacing(p => ({ ...p, [section.key]: false }))
  }

  const placeStore = async (section) => {
    const fulfillment = effFulfillment(section)
    if (!fulfillment) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Please choose Delivery or Pickup first.' }))
      return
    }
    if (!customer.name.trim() || !customer.email.trim()) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Please enter your name and email.' }))
      return
    }
    if (fulfillment === 'delivery' && !customer.address.trim()) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Please enter your delivery address.' }))
      return
    }
    setPlacing(p => ({ ...p, [section.key]: true }))
    setSectionStatus(s => ({ ...s, [section.key]: 'Placing your order...' }))
    try {
      // A picked popup location: delivery keeps the customer's address
      // as the destination (the label is the ship-from); pickup sends
      // the label as the address. Without a pick, exactly as before.
      const sel = selectedLoc[section.key]
      const locLabel = sel && sel.mode === fulfillment ? sel.label : null
      const res = await placeStoreOrder({
        providerId: section.providerId, name: customer.name, email: customer.email, phone: customer.phone,
        fulfillment, deliveryAddress: fulfillment === 'pickup' && locLabel ? locLabel : customer.address,
        cart: section.lines.map(l => ({ id: Number(l.key.slice(2)), qty: l.qty })),
      })
      const pdf = buildReceiptPdf({
        kind: 'order', refId: res.order_id, storeName: section.title,
        customer, lines: res.items, total: res.total,
        fulfillment, deliveryAddress: customer.address,
        locationLabel: locLabel || undefined,
      })
      const record = {
        order_id: res.order_id, store: section.title, customer: customer.name,
        customer_email: customer.email, customer_phone: customer.phone,
        fulfillment, delivery_address: customer.address, items: res.items, total: res.total,
        ...(locLabel ? (fulfillment === 'delivery' ? { shipFrom: locLabel } : { pickupLocation: locLabel }) : {}),
      }
      try {
        await emailReceipt({ subject: `New store order #${res.order_id} — ${section.title}`, record, pdfBase64: pdf.base64, filename: `receipt-order-${res.order_id}.pdf` })
      } catch { /* order is saved; email retry is a bonus */ }
      setLastOrder(prev => [...(prev || []), { kind: 'store', id: res.order_id, total: res.total, fulfillment, storeName: section.title, pdf, record }])
      removeSection(section.lines.map(l => l.key))
      clearSectionChoice(section.key)
      setSectionStatus(s => ({ ...s, [section.key]: '' }))
    } catch (err) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Error: ' + err.message }))
    }
    setPlacing(p => ({ ...p, [section.key]: false }))
  }

  // Hold a whole store section: same checks as placing the order, but
  // the row is a hold — no payment is taken online, the customer pays
  // at the store when arranging delivery/pickup.
  const placeHold = async (section) => {
    const fulfillment = effFulfillment(section)
    if (!fulfillment) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Please choose Delivery or Pickup first.' }))
      return
    }
    if (!customer.name.trim() || !customer.email.trim()) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Please enter your name and email.' }))
      return
    }
    if (fulfillment === 'delivery' && !customer.address.trim()) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Please enter your delivery address.' }))
      return
    }
    setPlacing(p => ({ ...p, [section.key]: true }))
    setSectionStatus(s => ({ ...s, [section.key]: 'Placing your hold...' }))
    try {
      const sel = selectedLoc[section.key]
      const locLabel = sel && sel.mode === fulfillment ? sel.label : null
      const res = await placeStoreHoldOrder({
        providerId: section.providerId, name: customer.name, email: customer.email, phone: customer.phone,
        fulfillment, deliveryAddress: fulfillment === 'pickup' && locLabel ? locLabel : customer.address,
        cart: section.lines.map(l => ({ id: Number(l.key.slice(2)), qty: l.qty })),
      })
      const pdf = buildReceiptPdf({
        kind: 'hold', refId: res.order_id, storeName: section.title,
        customer, lines: res.items, total: res.total,
        fulfillment, deliveryAddress: customer.address,
        locationLabel: locLabel || undefined,
      })
      const record = {
        order_id: res.order_id, store: section.title, customer: customer.name,
        customer_email: customer.email, customer_phone: customer.phone,
        fulfillment, delivery_address: customer.address, items: res.items, total: res.total, is_hold: true,
        ...(locLabel ? (fulfillment === 'delivery' ? { shipFrom: locLabel } : { pickupLocation: locLabel }) : {}),
      }
      try {
        await emailReceipt({ subject: `New hold order #${res.order_id} — ${section.title}`, record, pdfBase64: pdf.base64, filename: `receipt-hold-${res.order_id}.pdf` })
      } catch { /* hold is saved; email retry is a bonus */ }
      setLastOrder(prev => [...(prev || []), { kind: 'store', hold: true, id: res.order_id, total: res.total, fulfillment, storeName: section.title, pdf, record }])
      removeSection(section.lines.map(l => l.key))
      clearSectionChoice(section.key)
      setSectionStatus(s => ({ ...s, [section.key]: '' }))
    } catch (err) {
      setSectionStatus(s => ({ ...s, [section.key]: 'Error: ' + err.message }))
    }
    setPlacing(p => ({ ...p, [section.key]: false }))
  }

  const resendReceipt = async (r) => {
    const file = r.hold ? `receipt-hold-${r.id}.pdf` : `receipt-order-${r.id}.pdf`
    await emailReceipt({
      subject: `Receipt ${r.hold ? 'hold' : 'order'} #${r.id} — ${r.storeName}`,
      record: r.record, pdfBase64: r.pdf.base64, filename: file,
    })
    alert('Receipt emailed to the store owner.')
  }

  const receipts = lastOrder || []
  if (sections.length === 0 && receipts.length === 0) return null

  return (
    <div>
      {receipts.length > 0 && (
        <div className="hero-card receipt">
          {receipts.map((r, i) => (
            <div key={i}>
              <h3>✓ {r.hold ? `Hold #${r.id}` : `Order #${r.id}`} received!</h3>
              <p>
                Thank you — your {r.kind === 'store' ? `${r.storeName} ` : ''}{r.hold ? 'hold' : 'order'} total is <b>{money(r.total)}</b> ({r.fulfillment}).
                {r.hold
                  ? ` No payment was taken online — you pay at the store when you arrange ${r.fulfillment === 'delivery' ? 'your delivery' : 'your pickup'}.`
                  : ` We've emailed the details to our team and will contact you shortly to confirm ${r.fulfillment === 'delivery' ? 'your delivery' : 'your pickup'} and payment.`}
              </p>
              {r.kind === 'store' && (
                <div className="store-actions">
                  <button type="button" onClick={() => r.pdf.download(r.hold ? `receipt-hold-${r.id}.pdf` : `receipt-order-${r.id}.pdf`)}>⬇️ Download receipt</button>
                  <button type="button" className="btn-soft" onClick={() => resendReceipt(r)}>✉️ Email receipt</button>
                </div>
              )}
            </div>
          ))}
          <div className="store-actions">
            <button type="button" className="btn-soft" onClick={() => setLastOrder(null)}>Continue shopping</button>
          </div>
        </div>
      )}

      {sections.length > 0 && (
        <div className="form-card wide cart-card">
          <h3>🛒 Your cart</h3>
          <p className="hint">Everything you've added, grouped by store. Each store's order is placed separately.</p>
          <div className="row">
            <input required placeholder="Your name" value={customer.name} onChange={e => setCustomer({ ...customer, name: e.target.value })} />
            <input required placeholder="Email" type="email" value={customer.email} onChange={e => setCustomer({ ...customer, email: e.target.value })} />
          </div>
          <input placeholder="Phone" value={customer.phone} onChange={e => setCustomer({ ...customer, phone: e.target.value })} />
          <textarea placeholder="Your delivery address (needed for delivery orders)" value={customer.address} onChange={e => setCustomer({ ...customer, address: e.target.value })} />
          {sections.map(section => {
            const fulfillment = effFulfillment(section)
            const canDeliver = section.lines.every(l => l.delivery)
            const canPickup = section.lines.every(l => l.pickup)
            const total = section.lines.reduce((s, l) => s + l.price * l.qty, 0)
            const pickupAddresses = [...new Set(section.lines.map(l => l.pickup_address).filter(Boolean))]
            const deliveryFrom = [...new Set(section.lines.map(l => l.delivery_address).filter(Boolean))]
            const sel = selectedLoc[section.key]
            return (
              <div key={section.key} className="cart-section">
                <h4>🏬 {section.title}</h4>
                {section.lines.map(l => (
                  <div key={l.key} className="cart-row">
                    <span className="cart-name">{l.name} <small>({money(l.price)}{l.unit ? ` / ${l.unit}` : ''})</small></span>
                    <span className="qty-stepper">
                      <button type="button" onClick={() => setQty(l.key, l.qty - 1, l.stock ?? undefined)} aria-label="Less">−</button>
                      <span>{l.qty}</span>
                      <button type="button" onClick={() => setQty(l.key, l.qty + 1, l.stock ?? undefined)} aria-label="More">+</button>
                    </span>
                    <span className="cart-line-total">{money(l.price * l.qty)}</span>
                    <button type="button" className="cart-remove" onClick={() => setQty(l.key, 0)}>Remove</button>
                  </div>
                ))}
                <p className="cart-total">Section total: <b>{money(total)}</b></p>

                <div className="trip-tabs fulfill-tabs">
                  {canDeliver && <button type="button" className={chosen[section.key] === 'delivery' ? 'active' : ''} onClick={() => section.kind === 'grocery' ? handleGroceryClick(section, 'delivery') : handleFulfillClick(section, 'delivery')}>🚚 Delivery</button>}
                  {canPickup && <button type="button" className={chosen[section.key] === 'pickup' ? 'active' : ''} onClick={() => section.kind === 'grocery' ? handleGroceryClick(section, 'pickup') : handleFulfillClick(section, 'pickup')}>🏪 Pickup</button>}
                </div>
                {!canDeliver && !canPickup && <p className="hint">Nothing in this section supports delivery or pickup — remove those items to continue.</p>}
                {sel && sel.mode === fulfillment && (
                  <div className="addr-box">
                    <b>{sel.mode === 'delivery' ? 'Delivery from:' : 'Pickup at:'}</b>
                    <p>📍 {sel.label}</p>
                  </div>
                )}
                {!sel && fulfillment === 'pickup' && pickupAddresses.length > 0 && (
                  <div className="addr-box">
                    <b>Pickup address{pickupAddresses.length > 1 ? 'es' : ''}:</b>
                    {pickupAddresses.map(a => <p key={a}>📍 {a}</p>)}
                  </div>
                )}
                {!sel && fulfillment === 'delivery' && deliveryFrom.length > 0 && (
                  <div className="addr-box">
                    <b>Your order ships from:</b>
                    {deliveryFrom.map(a => <p key={a}>📍 {a}</p>)}
                  </div>
                )}
                {section.kind === 'grocery' ? (
                  <button
                    type="button"
                    disabled={placing[section.key] || (!canDeliver && !canPickup)}
                    onClick={() => placeGrocery(section)}
                  >
                    {placing[section.key] ? 'Placing order...' : `Place ${section.title} order — ${money(total)}`}
                  </button>
                ) : (() => {
                  const flags = providerFlags[section.providerId] || { holdorder: false, payorder: true }
                  const busy = placing[section.key] || (!canDeliver && !canPickup)
                  return (
                    <div className="cart-order-btns">
                      {flags.payorder && (
                        <button type="button" disabled={busy} onClick={() => placeStore(section)}>
                          {placing[section.key] ? 'Placing order...' : `Place ${section.title} order — ${money(total)}`}
                        </button>
                      )}
                      {flags.holdorder && (
                        <button type="button" className="btn-soft" disabled={busy} onClick={() => placeHold(section)}>
                          {placing[section.key] ? 'Placing hold...' : `Hold Order/Pay at ${section.title} Store — ${money(total)}`}
                        </button>
                      )}
                      {!flags.payorder && !flags.holdorder && (
                        <p className="hint">This store doesn't take orders online right now — please contact the store directly.</p>
                      )}
                    </div>
                  )
                })()}
                {sectionStatus[section.key] && <p className="status">{sectionStatus[section.key]}</p>}
              </div>
            )
          })}
        </div>
      )}

      {popup && (() => {
        const needle = popupQuery.trim().toLowerCase()
        const rows = needle ? popup.rows.filter(r => JSON.stringify(r).toLowerCase().includes(needle)) : popup.rows
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
              <button type="button" onClick={closePopup} aria-label="Close" style={{ position: 'absolute', top: 8, right: 12, fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
              <h3 style={{ marginTop: 0, paddingRight: 24 }}>{popup.mode === 'delivery' ? 'Choose a delivery location' : 'Choose a pickup location'}</h3>
              <input placeholder="Search locations..." value={popupQuery} onChange={e => setPopupQuery(e.target.value)} autoFocus style={{ width: '100%', boxSizing: 'border-box' }} />
              <div style={{ marginTop: 12 }}>
                {rows.length === 0 && <p className="hint">No locations match.</p>}
                {rows.map((r, i) => (
                  <div key={r.id} onClick={() => selectPopupRow(r)} style={{ padding: '10px 0', borderBottom: i === rows.length - 1 ? 'none' : '1px solid #e5e7eb', cursor: 'pointer' }}>
                    {locDisplay(r, popup.mode)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
