import { useEffect, useMemo, useState } from 'react'

import { GroceryTopBar } from './GroceryMenu'

import { useCart } from '../lib/CartContext'

import { loadItems, loadItemCategories, loadItemVariants, money } from '../lib/storeData'

import { StockLine, CardSlideshow, VariantMatrix } from './StoreBits'

// Category page: every category link shows the items linked to that
// category in the NEW category table (via store_item_categories), from
// all stores, active items only. Items are loaded once and filtered
// client-side to those whose attached categories array contains the
// slug. Each item shows its store, opens its detail page on tap, and
// can go straight into the one site-wide cart — the cart groups each
// store's items into their own section at checkout, so nothing gets
// mixed up. "Shop with us" opens the store's order page (all that
// store's products, with search) — the same page the Physical Stores
// list opens, not the store's about page.
//
// Props: slug (category link name), title / intro overrides for pages
// that reuse this view with their own heading.
export default function CategoryPage({ slug, go, title, intro }) {

  const [category, setCategory] = useState(null)

  const [items, setItems] = useState(null)

  const [error, setError] = useState('')

  const [query, setQuery] = useState('')

  const [justAdded, setJustAdded] = useState('')

  // The variant each item's matrix has matched (item id -> subCategory
  // row, or null while the choice is incomplete). Add to cart stays
  // disabled until the matrix has matched one (for items with 2+
  // variants); items with 0 or 1 variant add straight.
  const [picked, setPicked] = useState({})

  const { count, addStore } = useCart()

  // Effective variants per item (see loadItemVariants). Null until
  // loaded: while null, the matrix is not shown (fail open) so a slow
  // load can never block adding.
  const [itemVariants, setItemVariants] = useState(null)
  useEffect(() => {
    if (!items) return
    loadItemVariants(items.map(i => i.id)).then(setItemVariants).catch(() => {})
  }, [items])

  useEffect(() => {
    setCategory(null); setItems(null); setError(''); setJustAdded('')
    loadItemCategories()
      .then(cats => cats.find(c => c.slug === slug) || null)
      .then(cat => {
        setCategory(cat)
        if (cat) return loadItems().then(all => all.filter(i => (i.categories || []).some(c => c.slug === slug)))
        return []
      })
      .then(setItems)
      .catch(e => setError(e.message))
  }, [slug])

  const filtered = useMemo(() => {
    if (!items) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return items
    return items.filter(i =>
      [i.name, i.description, String(i.price), i.provider?.name, i.provider?.country, i.provider?.city, i.barCode || '']
        .join(' ').toLowerCase().includes(needle)
    )
  }, [items, query])

  const addToCart = (item) => {
    const rows = (itemVariants?.[item.id]) || []
    const variant = picked[item.id] || (rows.length === 1 ? rows[0] : null)
    addStore(item, 1, variant)
    setJustAdded(item.name)
    setTimeout(() => setJustAdded(''), 4000)
  }

  return (
    <div>
      <GroceryTopBar go={go} />

      <div className="hero-card">
        <h2>{title || (category ? category.label : 'Category')}</h2>
        <p>{intro || 'Items in this category, from all stores. Search by name, price, store or country. Tap an item for details.'}</p>
        <div className="filters">
          <input placeholder="Search items (e.g. lamb, 22, Morocco, barcode)" value={query} onChange={e => setQuery(e.target.value)} />
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
          const rows = (itemVariants?.[item.id]) || []
          const complete = rows.length < 2 || !!picked[item.id]
          return (
            <div className="card" key={item.id}>
              <CardSlideshow images={images} name={item.name} />
              <div className="card-body">
                <h3 className="clickable-title" onClick={() => go('item-detail', item.id)}>{item.name}</h3>
                <p className="g-price">{money(item.price)}</p>
                <StockLine stock={item.stock} />
                {item.description && <p className="car-desc desc-clamp">{item.description}</p>}
                {item.provider && <p className="hint">🏬 {item.provider.name}{item.provider.country ? ` · ${item.provider.country}` : ''}</p>}
                {item.barCode && <p className="hint">Barcode: {item.barCode}</p>}
                <p className="item-badges">
                  {item.delivery && <span className="badge">🚚 Delivery</span>}
                  {item.pickup && <span className="badge">🏪 Pickup</span>}
                </p>
                {rows.length >= 2 && (
                  <VariantMatrix rows={rows} onChange={(row) => setPicked(prev => ({ ...prev, [item.id]: row }))} />
                )}
                <div className="item-actions">
                  <button disabled={out || !complete} onClick={() => addToCart(item)}>{out ? 'Out of stock' : 'Add to cart'}</button>
                  <button className="btn-soft" onClick={() => go('item-detail', item.id)}>View details →</button>
                  <button className="btn-soft" onClick={() => go('store-order', item.provider_id)}>Shop with us</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )

}
