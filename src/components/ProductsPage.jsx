import { useEffect, useMemo, useState } from 'react'
import { GroceryTopBar } from './GroceryMenu'
import { useCart } from '../lib/CartContext'
import { loadItems, loadItemCategories, loadSubCategories, money, formatVariant } from '../lib/storeData'
import { StockLine, CardSlideshow, useVariantAdd } from './StoreBits'

// Products page: EVERY active store item, from every store, in one
// place — the same look as a store's order page (search + cards), but
// with no category tabs under the search bar. Instead, a filter icon
// on the left of the search bar opens a popup where the customer
// picks categories (from the category table) and, under each checked
// category, its variants (from subCategory). An item shows when it
// matches the search AND (no category checked OR it is linked to a
// checked category) AND (no variant checked OR one of its linked
// categories offers a checked variant).
export default function ProductsPage({ go }) {
  const [items, setItems] = useState(null)
  const [categories, setCategories] = useState([])
  const [subcats, setSubcats] = useState([])
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [justAdded, setJustAdded] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [selCats, setSelCats] = useState([])
  const [selSubs, setSelSubs] = useState([])
  const { count } = useCart()
  const { requestAdd, variantPopup } = useVariantAdd()

  useEffect(() => {
    loadItems({}).then(setItems).catch(e => setError(e.message))
    loadItemCategories().then(setCategories).catch(() => {})
    loadSubCategories().then(setSubcats).catch(() => {})
  }, [])

  const subsByCat = useMemo(() => {
    const map = {}
    for (const s of subcats) {
      if (!map[s.category_id]) map[s.category_id] = []
      map[s.category_id].push(s)
    }
    return map
  }, [subcats])

  const filtered = useMemo(() => {
    if (!items) return []
    const needle = query.trim().toLowerCase()
    const checkedSubCatIds = new Set(
      subcats.filter(s => selSubs.includes(s.id)).map(s => s.category_id)
    )
    return items.filter(i => {
      if (needle && ![i.name, i.description, String(i.price), i.provider?.name].join(' ').toLowerCase().includes(needle)) return false
      const cats = i.categories || []
      if (selCats.length > 0 && !cats.some(c => selCats.includes(c.id))) return false
      if (selSubs.length > 0 && !cats.some(c => checkedSubCatIds.has(c.id))) return false
      return true
    })
  }, [items, query, selCats, selSubs, subcats])

  const toggle = (list, setList, id) =>
    setList(list.includes(id) ? list.filter(x => x !== id) : [...list, id])

  const clearFilters = () => { setSelCats([]); setSelSubs([]) }
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
        <h2>🛍️ Products</h2>
        <p>Every item from every store, in one place. Search, filter by category, and add to your cart — your cart groups each store's items into their own section at checkout.</p>
        {count > 0 && (
          <p><button type="button" className="link-btn" onClick={() => go('grocery-cart')}>🛒 View My Cart ({count})</button></p>
        )}
        {justAdded && <p className="status">✓ “{justAdded}” added to your cart.</p>}
        <div className="filters">
          <button type="button" onClick={() => setFilterOpen(true)} aria-label="Filter products" title="Filter products">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M3 5h18" /><path d="M7 12h10" /><path d="M10 19h4" /></svg>
            {activeFilterCount > 0 && <span> ({activeFilterCount})</span>}
          </button>
          <input placeholder="Search products (e.g. bread, 8.50, Paris)" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {items && <p className="hint">{filtered.length} item{filtered.length === 1 ? '' : 's'}</p>}
      </div>

      {error && (
        <div className="hero-card"><p>Couldn't load products: {error}.</p></div>
      )}
      {!error && items === null && <div className="hero-card"><p>Loading products...</p></div>}
      {!error && items && filtered.length === 0 && (
        <div className="hero-card"><p>No products match. Try a different search, clear the filters, or add some items from Admin.</p></div>
      )}

      <div className="grid">
        {filtered.map(item => {
          const images = item.pics || []
          const out = item.stock !== null && item.stock !== undefined && item.stock <= 0
          return (
            <div className="card" key={item.id}>
              <CardSlideshow images={images} name={item.name} />
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
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {variantPopup}

      {filterOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 520, maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
            <button type="button" onClick={() => setFilterOpen(false)} aria-label="Close" style={{ position: 'absolute', top: 8, right: 12, fontSize: 20, lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            <h3 style={{ marginTop: 0, paddingRight: 24 }}>Filter products</h3>
            {categories.length === 0 && <p className="hint">No categories yet — add some from Admin.</p>}
            {categories.map(c => (
              <div key={c.id} style={{ marginBottom: 10 }}>
                <label><input type="checkbox" checked={selCats.includes(c.id)} onChange={() => toggle(selCats, setSelCats, c.id)} /> <b>{c.label}</b></label>
                {selCats.includes(c.id) && (subsByCat[c.id] || []).map(s => (
                  <div key={s.id} style={{ marginLeft: 24 }}>
                    <label><input type="checkbox" checked={selSubs.includes(s.id)} onChange={() => toggle(selSubs, setSelSubs, s.id)} /> {formatVariant(s)}</label>
                  </div>
                ))}
              </div>
            ))}
            <div className="store-actions" style={{ marginTop: 12 }}>
              <button type="button" className="btn-soft" onClick={clearFilters}>Clear filters</button>
              <button type="button" onClick={() => setFilterOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
