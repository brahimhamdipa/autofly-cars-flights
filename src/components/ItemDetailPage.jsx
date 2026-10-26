import { useEffect, useState } from 'react'
import { Lightbox } from './CarSection'
import { GroceryTopBar } from './GroceryMenu'
import { useCart } from '../lib/CartContext'
import { loadItem, money } from '../lib/storeData'
import { StockLine, HoldModal } from './StoreBits'

// Item detail page: tapping any store item anywhere on the site lands
// here — big pictures, price, stock, description, the store it belongs
// to, and the two things a buyer wants: Add to cart and Hold the item.
// This fixes the old dead end where an item found on a category page
// (e.g. the AutoFly T-Shirt on Clothes) vanished on the store's order
// page, which only listed "Store products".
export default function ItemDetailPage({ itemId, go, goBack }) {
  const [item, setItem] = useState(null)
  const [error, setError] = useState('')
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const [hold, setHold] = useState(false)
  const [added, setAdded] = useState(false)
  const { addStore, count } = useCart()

  useEffect(() => {
    setItem(null); setError(''); setAdded(false)
    loadItem(itemId).then(setItem).catch(e => setError(e.message))
  }, [itemId])

  const images = item?.pics || []
  const n = images.length
  const out = item && item.stock !== null && item.stock !== undefined && item.stock <= 0

  return (
    <div>
      <GroceryTopBar go={go} />

      {error && (
        <div className="hero-card"><p>Couldn't load this item: {error}</p></div>
      )}
      {!error && !item && <div className="hero-card"><p>Loading item...</p></div>}
      {!error && item && (
        <div>
          <div className="hero-card">
            {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}
            <h2>{item.name}</h2>
            {item.category && <p className="hint">{item.category.name}{item.provider ? ` · 🏬 ${item.provider.name}` : ''}</p>}
          </div>

          <div className="store-detail">
            <div className="store-photos">
              <div className="slideshow">
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
              {zoom && n > 0 && <Lightbox images={images} start={idx} onClose={() => setZoom(false)} />}
            </div>
            <div className="store-info">
              <p className="g-price">{money(item.price)}</p>
              <StockLine stock={item.stock} />
              {item.description && <p>{item.description}</p>}
              <p className="item-badges">
                {item.delivery && <span className="badge">🚚 Delivery</span>}
                {item.pickup && <span className="badge">🏪 Pickup</span>}
                {item.online && <span className="badge">🌐 Also on the Online Store</span>}
              </p>
              {item.provider && (
                <p className="hint">
                  Sold by {item.provider.name}
                  {item.provider.city || item.provider.country ? ` — ${[item.provider.city, item.provider.country].filter(Boolean).join(', ')}` : ''}
                  {item.provider.phone ? ` · ${item.provider.phone}` : ''}
                </p>
              )}
              <div className="store-actions">
                <button
                  disabled={out}
                  onClick={() => { addStore(item); setAdded(true) }}
                >
                  {out ? 'Out of stock' : '🛒 Add to cart'}
                </button>
//                <button className="btn-soft" onClick={() => setHold(true)}>Hold the item</button>
              </div>
              {added && (
                <p className="status">
                  ✓ Added to your cart. <button type="button" className="link-btn" onClick={() => go('grocery-cart')}>View My Cart ({count})</button>
                </p>
              )}
              <div className="store-actions">
                <button type="button" className="btn-soft" onClick={() => go('store-order', item.provider_id)}>Order from this store</button>
                <button type="button" className="btn-soft" onClick={() => go('store-detail', item.provider_id)}>About this store</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {hold && item && (
        <HoldModal item={item} providerName={item.provider?.name || 'Store'} onClose={() => setHold(false)} />
      )}
    </div>
  )
}
