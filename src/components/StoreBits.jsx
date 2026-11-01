import { useState } from 'react'

import { Lightbox } from './CarSection'

import { useCart } from '../lib/CartContext'

import { loadItemVariants, formatVariant } from '../lib/storeData'

// Stock line, exactly like the Online Store page: green when in stock,
// red when out of stock, nothing at all when stock is not tracked
// (null — e.g. services).
export function StockLine({ stock }) {
  if (stock === null || stock === undefined) return null
  if (stock <= 0) return <p className="stock out">Out of stock</p>
  if (stock <= 10) return <p className="stock low">Only {stock} left in stock</p>
  return <p className="stock ok">{stock} available in stock</p>
}

// Card picture slideshow, exactly like the Physical Stores cards:
// arrows + counter in the card, tap the picture for the fullscreen
// Lightbox (X top-right to close). Used by the Online Store and
// category cards (General Products, Lunches/Snacks, Meats, Clothes).
export function CardSlideshow({ images, name }) {
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const pics = images || []
  const n = pics.length
  return (
    <>
      <div className="slideshow">
        {n > 0 ? (
          <img src={pics[idx]} alt={name} onClick={() => setZoom(true)} title="Click to enlarge" />
        ) : (
          <div className="no-photo">No photos yet</div>
        )}
        {n > 1 && (
          <>
            <button className="slide-btn prev" onClick={() => setIdx(i => (i - 1 + n) % n)} aria-label="Previous photo">‹</button>
            <button className="slide-btn next" onClick={() => setIdx(i => (i + 1 + n) % n)} aria-label="Next photo">›</button>
            <span className="slide-count">{idx + 1} / {n}</span>
          </>
        )}
      </div>
      {zoom && n > 0 && <Lightbox images={pics} start={idx} onClose={() => setZoom(false)} />}
    </>
  )
}

// Variant picker popup: one radio option per subCategory row, formatted
// with formatVariant. The "Add to cart" button stays disabled until the
// customer picks one. Closing (X, or tapping outside) adds nothing.
// onPick receives the picked row. Inline styles only — no CSS change.
export function VariantPopup({ rows, onPick, onClose }) {
  const [picked, setPicked] = useState(null)
  const list = rows || []
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 12, padding: 20, maxWidth: 420, width: '100%', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}
        onClick={e => e.stopPropagation()}
      >
        <button type="button" aria-label="Close" onClick={onClose} style={{ position: 'absolute', top: 8, right: 12, background: 'none', border: 'none', fontSize: 22, cursor: 'pointer' }}>×</button>
        <h3 style={{ marginTop: 0, paddingRight: 24 }}>Choose an option</h3>
        <p className="hint">Pick one before adding to your cart.</p>
        {list.map(row => (
          <label key={row.id} style={{ display: 'block', padding: '10px 8px', borderBottom: '1px solid #eee', cursor: 'pointer' }}>
            <input type="radio" name="variant" checked={picked === row.id} onChange={() => setPicked(row.id)} style={{ marginRight: 8 }} />
            {formatVariant(row) || ('Option ' + row.id)}
          </label>
        ))}
        <button
          type="button"
          disabled={picked === null}
          onClick={() => { const row = list.find(r => r.id === picked); if (row) onPick(row) }}
          style={{ marginTop: 16, width: '100%' }}
        >
          Add to cart
        </button>
      </div>
    </div>
  )
}

// Variant-aware "Add to cart" for any item card or detail page:
// - 0 variants -> adds straight to the cart, then onAdded.
// - exactly 1 variant -> adds straight with that variant, then onAdded.
// - 2+ variants -> opens the VariantPopup; picking adds with the picked
//   variant, then onAdded. Closing the popup adds nothing.
// A second requestAdd while the popup is open replaces the pending item.
// If the variant lookup itself fails, the item is added plainly (a failed
// lookup must never leave the customer tapping Add with nothing happening).
export function useVariantAdd() {
  const { addStore } = useCart()
  const [pending, setPending] = useState(null) // { item, rows, onAdded } or null

  const requestAdd = async (item, onAdded) => {
    let rows = []
    try {
      const variants = await loadItemVariants([item.id])
      rows = variants[item.id] || []
    } catch {
      addStore(item, 1)
      if (onAdded) onAdded()
      return
    }
    if (rows.length === 0) {
      addStore(item, 1)
      if (onAdded) onAdded()
    } else if (rows.length === 1) {
      addStore(item, 1, rows[0])
      if (onAdded) onAdded()
    } else {
      setPending({ item, rows, onAdded })
    }
  }

  const variantPopup = pending ? (
    <VariantPopup
      rows={pending.rows}
      onClose={() => setPending(null)}
      onPick={(row) => {
        addStore(pending.item, 1, row)
        const cb = pending.onAdded
        setPending(null)
        if (cb) cb()
      }}
    />
  ) : null

  return { requestAdd, variantPopup }
}
