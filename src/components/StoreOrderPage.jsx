import { useEffect, useMemo, useState } from 'react'
import { Lightbox } from './CarSection'
import { GroceryTopBar } from './GroceryMenu'
import { useCart } from '../lib/CartContext'
import { loadProvider, loadItems, money } from '../lib/storeData'
import { StockLine, HoldModal } from './StoreBits'

// "Order from us" page for one store: ALL of this provider's active
// items (not just "Store products"), with category tabs to narrow down.
// Adding goes to the ONE site-wide cart (grouped by store at checkout).
// This fixes the old dead end where an item found on a category page
// vanished here because only "Store products" were listed.
function ItemCard({ item, onAdd, onHold, onOpen }) {
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const images = item.pics || []
  const n = images.length
  const out = item.stock !== null && item.stock !== undefined && item.stock <= 0
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
        <h3 className="clickable-title" onClick={onOpen}>{item.name}</h3>
        <p className="g-price">{money(item.price)}</p>
        <StockLine stock={item.stock} />
        {item.description && <p className="car-desc">{item.description}</p>}
        {item.category && <p className="hint">{item.category.name}</p>}
        <p className="item-badges">
          {item.delivery && <span className="badge">🚚 Delivery</span>}
          {item.pickup && <span className="badge">🏪 Pickup</span>}
        </p>
        <div className="item-actions">
          <button disabled={out} onClick={() => onAdd(item)}>{out ? 'Out of stock' : 'Add to cart'}</button>
          <button className="btn-soft" onClick={onOpen}>View details →</button>
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
  const [catFilter, setCatFilter] = useState('all')
  const [holdItem, setHoldItem] = useState(null)
  const [justAdded, setJustAdded] = useState('')
  const { addStore, count } = useCart()

  useEffect(() => {
    setProvider(null); setItems(null); setError(''); setCatFilter('all'); setJustAdded('')
    loadProvider(providerId).then(setProvider).catch(e => setError(e.message))
    loadItems({ providerId }).then(setItems).catch(e => setError(e.message))
  }, [providerId])

  const categories = useMemo(() => {
    const map = {}
    for (const i of items || []) {
      if (i.category) map[i.category.slug] = i.category.name
    }
    return Object.entries(map).sort((a, b) => a[1].localeCompare(b[1]))
  }, [items])

  const filtered = useMemo(() => {
    if (!items) return []
    const needle = query.trim().toLowerCase()
    return items.filter(i =>
      (catFilter === 'all' || i.category?.slug === catFilter) &&
      (!needle || [i.name, i.description, String(i.price), i.category?.name].join(' ').toLowerCase().includes(needle))
    )
  }, [items, query, catFilter])

  const addToCart = (item) => {
    addStore(item)
    setJustAdded(item.name)
    setTimeout(() => setJustAdded(''), 4000)
  }

  return (
    <div>
      <GroceryTopBar go={go} />

      <div className="hero-card">
        <button className="link-btn" onClick={() => go('store-detail', providerId)}>← Back to {provider ? provider.name : 'store'}</button>
        <h2>🛒 Order from {provider ? provider.name : 'this store'}</h2>
        <p>Everything this store sells — tap an item for details, add it to your cart, or hold it. Your cart groups each store's items into their own section at checkout.</p>
        {count > 0 && (
          <p><button type="button" className="link-btn" onClick={() => go('grocery-cart')}>🛒 View My Cart ({count})</button></p>
        )}
        {justAdded && <p className="status">✓ "{justAdded}" added to your cart.</p>}
        <div className="filters">
          <input placeholder="Search items (e.g. bread, 8.50)" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {categories.length > 1 && (
          <div className="report-links">
            <button type="button" className={catFilter === 'all' ? 'active' : ''} onClick={() => setCatFilter('all')}>All</button>
            {categories.map(([slug, name]) => (
              <button key={slug} type="button" className={catFilter === slug ? 'active' : ''} onClick={() => setCatFilter(slug)}>{name}</button>
            ))}
          </div>
        )}
        {items && <p className="hint">{filtered.length} item{filtered.length === 1 ? '' : 's'}</p>}
      </div>

      {error && (
        <div className="hero-card"><p>Couldn't load items: {error}. If the store tables are not set up yet, run <b>supabase/store-tables.sql</b> in the Supabase SQL editor.</p></div>
      )}
      {!error && items === null && <div className="hero-card"><p>Loading items...</p></div>}
      {!error && items && filtered.length === 0 && (
        <div className="hero-card"><p>No items match. This store has no items yet — add some from Admin.</p></div>
      )}

      <div className="grid">
        {filtered.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            onAdd={addToCart}
            onHold={setHoldItem}
            onOpen={() => go('item-detail', item.id)}
          />
        ))}
      </div>

      {holdItem && (
        <HoldModal item={holdItem} providerName={provider?.name || 'Store'} onClose={() => setHoldItem(null)} />
      )}
    </div>
  )
}
