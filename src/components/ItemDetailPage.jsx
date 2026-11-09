import { useEffect, useState } from 'react'

import { Lightbox } from './CarSection'

import { GroceryTopBar } from './GroceryMenu'

import { useCart } from '../lib/CartContext'

import { loadItem, loadItemVariants, money } from '../lib/storeData'

import { StockLine, VariantMatrix } from './StoreBits'

// Item detail page: tapping any store item anywhere on the site lands
// here. Laid out like the store page (ProviderPage): ONE section with
// the pictures on top, then price, stock, the FULL description, the
// store it belongs to, and the buttons in one row — Add to cart (blue)
// and About store (gray, opens the store's about page). This fixes the
// old dead end where an item found on a category page (e.g. the
// AutoFly T-Shirt on Clothes) vanished on the store's order page,
// which only listed "Store products".
export default function ItemDetailPage({ itemId, go, goBack }) {

  const [item, setItem] = useState(null)

  const [error, setError] = useState('')

  const [idx, setIdx] = useState(0)

  const [zoom, setZoom] = useState(false)

  const [added, setAdded] = useState(false)

  // The item's variants and the one this page's matrix has matched (a
  // subCategory row, or null while the choice is incomplete). Add to
  // cart stays disabled until the matrix has matched one (for items
  // with 2+ variants); items with 0 or 1 variant add straight.
  const [itemVariants, setItemVariants] = useState(null)
  const [picked, setPicked] = useState(null)

  const { count, addStore } = useCart()

  useEffect(() => {
    setItem(null); setError(''); setAdded(false); setPicked(null)
    loadItem(itemId).then(setItem).catch(e => setError(e.message))
    loadItemVariants([itemId]).then(v => setItemVariants(v[itemId] || [])).catch(() => setItemVariants([]))
  }, [itemId])

  const rows = itemVariants || []
  const complete = rows.length < 2 || picked !== null
  const handleAdd = () => {
    const variant = picked || (rows.length === 1 ? rows[0] : null)
    addStore(item, 1, variant)
    setAdded(true)
  }

  const images = item?.pics || []

  const n = images.length

  const out = item && item.stock !== null && item.stock !== undefined && item.stock <= 0

  const headerParts = []
  if (item?.categories?.length > 0) headerParts.push(item.categories.map(c => c.label).join(' · '))
  if (item?.provider) headerParts.push(`🏬 ${item.provider.name}`)
  const headerLine = headerParts.join(' · ')

  return (
    <div>
      <GroceryTopBar go={go} />

      {error && (
        <div className="hero-card"><p>Couldn't load this item: {error}</p></div>
      )}
      {!error && !item && <div className="hero-card"><p>Loading item...</p></div>}
      {!error && item && !item.is_active && (
        <div className="hero-card"><p>This item is not available.</p></div>
      )}
      {!error && item && item.is_active && (
        <div>
          <div className="hero-card">
            {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}
            <h2>{item.name}</h2>
            {headerLine && <p className="hint">{headerLine}</p>}
          </div>

          <div className="form-card wide store-info item-detail-card">
            <div className="slideshow store-photos">
                {n > 0 ? (
                  <img src={images[idx]} alt={item.name} onClick={() => setZoom(true)} title="Click to enlarge" />
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

            <div className="card-body">
            <p className="g-price">{money(item.price)}</p>
              <StockLine stock={item.stock} />
              {item.description && <p>{item.description}</p>}
              {item.barCode && <p className="hint">Barcode: {item.barCode}</p>}
              <p className="item-badges">
                {item.delivery && <span className="badge">🚚 Delivery</span>}
                {item.pickup && <span className="badge">🏪 Pickup</span>}
              </p>
              {item.provider && (
                <p className="hint">
                  Sold by {item.provider.name}
                  {item.provider.city || item.provider.country ? ` — ${[item.provider.city, item.provider.country].filter(Boolean).join(', ')}` : ''}
                  {item.provider.phone ? ` · ${item.provider.phone}` : ''}
                </p>
              )}
            {rows.length >= 2 && (
              <VariantMatrix rows={rows} onChange={setPicked} />
            )}
            <div className="item-actions">
              <button
                disabled={out || !complete}
                onClick={handleAdd}
              >
                {out ? 'Out of stock' : '🛒 Add to cart'}
              </button>
              <button type="button" className="btn-soft" onClick={() => go('store-detail', item.provider_id)}>About store</button>
            </div>
            {added && (
              <p className="status">
                ✓ Added to your cart. <button type="button" className="link-btn" onClick={() => go('grocery-cart')}>View My Cart ({count})</button>
              </p>
            )}
            </div>
          </div>

          {zoom && n > 0 && <Lightbox images={images} start={idx} onClose={() => setZoom(false)} />}
        </div>
      )}

    </div>
  )

}
