import { useEffect, useMemo, useState } from 'react'

import { Lightbox } from './CarSection'

import { GroceryTopBar } from './GroceryMenu'

import { useCart } from '../lib/CartContext'

import { loadProvider, loadItems, loadSubCategories, loadItemVariants, money } from '../lib/storeData'

import { StockLine, useVariantAdd } from './StoreBits'
import FilterPopup from './FilterPopup'
import ScrollTopButton from './ScrollTopButton'

// "Order from us" page for one store: ALL of this provider's active
// items (not just "Store products"), with a store-scoped filter popup to narrow down.
// Filter categories come from the items' attached categories arrays (the new
// category table, via store_item_categories) — one filter entry per distinct
// category across this store's items. Adding goes to the ONE site-wide
// cart (grouped by store at checkout).
// This fixes the old dead end where an item found on a category page
// vanished here because only "Store products" were listed.

function ItemCard({ item, onAdd, onOpen }) {

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
            <button className="slide-btn next" onClick={() => setIdx(i => (i + 1 + n) % n)} aria-label="Next photo">›</button>
            <span className="slide-count">{idx + 1} / {n}</span>
          </>
        )}
      </div>
      <div className="card-body">
        <h3 className="clickable-title" onClick={onOpen}>{item.name}</h3>
        <p className="g-price">{money(item.price)}</p>
        <StockLine stock={item.stock} />
        {item.description && <p className="car-desc desc-clamp">{item.description}</p>}
        {item.categories && item.categories.length > 0 && <p className="hint">{item.categories.map(c => c.label).join(' · ')}</p>}
        <p className="item-badges">
          {item.delivery && <span className="badge">🚚 Delivery</span>}
          {item.pickup && <span className="badge">🏪 Pickup</span>}
        </p>
        <div className="item-actions">
          <button disabled={out} onClick={() => onAdd(item)}>{out ? 'Out of stock' : 'Add to cart'}</button>
          <button className="btn-soft" onClick={onOpen}>View details →</button>
        </div>
      </div>
      {zoom && n > 0 && <Lightbox images={images} start={idx} onClose={() => setZoom(false)} />}
    </div>
  )

}


export default function StoreOrderPage({ providerId, go, goBack }) {

  const [provider, setProvider] = useState(null)

  const [items, setItems] = useState(null)

  const [error, setError] = useState('')

  const [query, setQuery] = useState('')

  const [selCats, setSelCats] = useState([])
  const [selSubs, setSelSubs] = useState([])
  const [filterOpen, setFilterOpen] = useState(false)
  const [itemVariants, setItemVariants] = useState(null) // null = not loaded yet → filter fails OPEN
  const [subcats, setSubcats] = useState([])

  const [justAdded, setJustAdded] = useState('')

  const { count } = useCart()

  const { requestAdd, variantPopup } = useVariantAdd()

  useEffect(() => {
  setProvider(null); setItems(null); setError(''); setSelCats([]); setSelSubs([]); setFilterOpen(false); setJustAdded('')
    loadProvider(providerId).then(setProvider).catch(e => setError(e.message))
    loadItems({ providerId }).then(setItems).catch(e => setError(e.message))
  }, [providerId])
  useEffect(() => {
    loadSubCategories().then(setSubcats).catch(() => {})
  }, [])
  useEffect(() => {
    if (!items) return
    loadItemVariants(items.map(i => i.id)).then(setItemVariants).catch(() => {})
  }, [items])

  const categories = useMemo(() => {
    const map = {}
    for (const i of items || []) {
      for (const c of i.categories || []) map[c.id] = c
    }
    return Object.values(map).sort((a, b) => a.label.localeCompare(b.label))
  }, [items])
  const scopedSubcats = useMemo(() => {
    const ids = new Set(categories.map(c => c.id))
    return subcats.filter(s => ids.has(s.category_id))
  }, [categories, subcats])
  const filtered = useMemo(() => {
    if (!items) return []
    const needle = query.trim().toLowerCase()
    return items.filter(i =>
      (selCats.length === 0 || (i.categories || []).some(c => selCats.includes(c.id))) &&
      (selSubs.length === 0 || !itemVariants || (itemVariants[i.id] || []).some(v => selSubs.includes(v.id))) &&
      (!needle || [i.name, i.description, String(i.price), ...(i.categories || []).map(c => c.label)].join(' ').toLowerCase().includes(needle))
  )
  }, [items, query, selCats, selSubs, itemVariants])
  const toggle = (list, setList, id) =>
    setList(list.includes(id)? list.filter(x => x!== id): [...list, id])
  const toggleCat = (id) => toggle(selCats, setSelCats, id)
  const toggleSub = (id) => toggle(selSubs, setSelSubs, id)
    const clearFilters = () => { setSelCats([]); setSelSubs([])}
  const activeFilterCount = selCats.length + selSubs.length
      const addToCart = (item) => {
    requestAdd(item, () => {
      setJustAdded(item.name)
      setTimeout(() => setJustAdded(''), 4000)
    })
  }

  return (
    <div>
      <GroceryTopBar go={go} />

      <div className="hero-card">
        {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}
        <h2>🛒 Order from {provider ? provider.name : 'this store'}</h2>
        <p>Everything this store sells — tap an item for details or add it to your cart. Your cart groups each store's items into their own section at checkout.</p>
        {count > 0 && (
          <p><button type="button" className="link-btn" onClick={() => go('grocery-cart')}>🛒 View My Cart ({count})</button></p>
        )}
        {justAdded && <p className="status">✓ "{justAdded}" added to your cart.</p>}
        <div className="filters">
            <button type="button" onClick={() => setFilterOpen(true)} aria-label="Filter items" title="Filter items">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 5h18" /><path d="M7 12h10" /><path d="M10 19h4" /></svg>
              {activeFilterCount > 0 && <span> ({activeFilterCount})</span>}
            </button>
          <input placeholder="Search items (e.g. bread, 8.50)" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
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
            onOpen={() => go('item-detail', item.id)}
          />
        ))}
      </div>

      {variantPopup}
      {filterOpen && (
        <FilterPopup
            title="Filter items"
          categories={categories}
          subcats={scopedSubcats}
          selCats={selCats}
          selSubs={selSubs}
          onToggleCat={toggleCat}
          onToggleSub={toggleSub}
          onClear={clearFilters}
          onClose={() => setFilterOpen(false)}
          />
      )}
      <ScrollTopButton />
    </div>
  )

}
