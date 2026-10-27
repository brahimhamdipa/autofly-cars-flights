import { useEffect, useMemo, useState } from 'react'
import { Lightbox } from './CarSection'
import { GroceryTopBar } from './GroceryMenu'
import { useCart } from '../lib/CartContext'
import { loadItems, loadCategories, money } from '../lib/storeData'
import { StockLine } from './StoreBits'

// Category page: every submenu category link queries the Items table
// filtered by category (and only active items). Each item shows its
// store, opens its detail page on tap, and can go straight into the one
// site-wide cart — the cart groups each store's items into their own
// section at checkout, so nothing gets mixed up. "Shop with us" opens
// the store's order page (all that store's products, with search) —
// the same page the Physical Stores list opens, not the store's
// about page.
//
// Props: slug (category link name), onlineFilter (true/false/null —
// used by the "Groceries / General Products" page for items NOT sold
// online), title / intro overrides for that page.
export default function CategoryPage({ slug, go, onlineFilter, title, intro }) {
  const [category, setCategory] = useState(null)
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(null)
  const [justAdded, setJustAdded] = useState('')
  const { addStore } = useCart()

  useEffect(() => {
    setCategory(null); setItems(null); setError(''); setJustAdded('')
    loadCategories()
      .then(cats => cats.find(c => c.slug === slug) || null)
      .then(cat => {
        setCategory(cat)
        if (cat) return loadItems({ categorySlug: slug, onlineFilter })
        return []
      })
      .then(setItems)
      .catch(e => setError(e.message))
  }, [slug, onlineFilter])

  const filtered = useMemo(() => {
    if (!items) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter(i =>
      [i.name, i.description, String(i.price), i.provider?.name, i.provider?.country, i.provider?.city]
        .join(' ').toLowerCase().includes(needle)
    )
  }, [items, query])

  const addToCart = (item) => {
    addStore(item)
    setJustAdded(item.name)
    setTimeout(() => setJustAdded(''), 4000)
  }

  return (
    <div>
      <GroceryTopBar go={go} />

      <div className="hero-card">
        <h2>{title || (category ? category.name : 'Category')}</h2>
        <p>{intro || 'Items in this category, from all stores. Search by name, price, store or country. Tap an item for details.'}</p>
        <div className="filters">
          <input placeholder="Search items (e.g. lamb, 22, Morocco)" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {justAdded && <p className="status">✓ "{justAdded}" added to your cart.</p>}
        {items && <p className="hint">{filtered.length} item{filtered.length === 1 ? '' : 's'} found</p>}
      </div>

      {error && (
        <div className="hero-card"><p>Couldn't load items: {error}. If the store tables are not set up yet, run <b>supabase/store-tables.sql</b> in the Supabase SQL editor.</p></div>
      )}
      {!error && items === null && <div className="hero-card"><p>Loading items...</p></div>}
      {!error && category === null && items !== null && !title && (
        <div className="hero-card"><p>Unknown category. Pick one from the submenu.</p></div>
      )}
      {!error && items && filtered.length === 0 && category && (
        <div className="hero-card"><p>No items in this category yet — add some from Admin.</p></div>
      )}

      <div className="grid">
        {filtered.map(item => {
          const images = item.pics || []
          const out = item.stock !== null && item.stock !== undefined && item.stock <= 0
          return (
            <div className="card" key={item.id}>
              <div className="slideshow">
                {images.length > 0 ? (
                  <img src={images[0]} alt={item.name} onClick={() => setZoom(images)} title="Click to enlarge" />
                ) : (
                  <div className="no-photo">No photos yet</div>
                )}
              </div>
              <div className="card-body">
                <h3 className="clickable-title" onClick={() => go('item-detail', item.id)}>{item.name}</h3>
                <p className="g-price">{money(item.price)}</p>
                <StockLine stock={item.stock} />
                {item.description && <p className="car-desc desc-clamp">{item.description}</p>}
                {item.provider && <p className="hint">🏬 {item.provider.name}{item.provider.country ? ` · ${item.provider.country}` : ''}</p>}
                <p className="item-badges">
                  {item.delivery && <span className="badge">🚚 Delivery</span>}
                  {item.pickup && <span className="badge">🏪 Pickup</span>}
                </p>
                <div className="item-actions">
                  <button disabled={out} onClick={() => addToCart(item)}>{out ? 'Out of stock' : 'Add to cart'}</button>
                  <button className="btn-soft" onClick={() => go('item-detail', item.id)}>View details →</button>
                  <button className="btn-soft" onClick={() => go('store-order', item.provider_id)}>Shop with us</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {zoom && <Lightbox images={zoom} start={0} onClose={() => setZoom(null)} />}
    </div>
  )
}
