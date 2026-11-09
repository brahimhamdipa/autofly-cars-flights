import { useEffect, useMemo, useState } from 'react'
import { GroceryTopBar } from './GroceryMenu'
import { useCart } from '../lib/CartContext'
import { loadItems, loadItemCategories, loadSubCategories, loadItemVariants, money, formatVariant } from '../lib/storeData'
import { StockLine, CardSlideshow, useVariantAdd } from './StoreBits'
import FilterPopup from './FilterPopup'
import ScrollTopButton from './ScrollTopButton'

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
    // Effective variants per item (see loadItemVariants). Null until loaded:
    // while null, the subcategory filter is skipped (fail open) so a slow
    // load can never empty the list.
    const [itemVariants, setItemVariants] = useState(null)
    useEffect(() => {
          if (!items) return
          loadItemVariants(items.map(i => i.id)).then(setItemVariants).catch(() => {})
    }, [items])

  
    // Filter categories come from the available products themselves
  // (same as a Shop-with-us page): only categories that have products
  // appear, and only their subcategories are offered.
    const prodCategories = useMemo(() => {
    const map = {}
    for (const i of items || []) {
      for (const c of i.categories || []) map[c.id] = c
                                 }
return Object.values(map).sort((a, b) => a.label.localeCompare(b.label))
    }, [items])
  const prodSubcats = useMemo(() => {
    const ids = new Set(prodCategories.map(c => c.id))
    return subcats.filter(s => ids.has(s.category_id))
  }, [prodCategories, subcats])

    
  const filtered = useMemo(() => {
    if (!items) return []
    const needle = query.trim().toLowerCase()
    
    return items.filter(i => {
      if (needle && ![i.name, i.description, String(i.price), i.provider?.name].join(' ').toLowerCase().includes(needle)) return false
      const cats = i.categories || []
      if (selCats.length > 0 && !cats.some(c => selCats.includes(c.id))) return false
      if (selSubs.length > 0 && itemVariants && !(itemVariants[i.id] || []).some(v => selSubs.includes(v.id))) return false
      return true
    })
    }, [items, query, selCats, selSubs, subcats, itemVariants])

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
                {item.barCode && <p className="hint">Barcode: {item.barCode}</p>}
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
            <ScrollTopButton />

      {filterOpen && (
              <FilterPopup
                        title="Filter products"
                        categories={prodCategories}
                        subcats={prodSubcats}
                        selCats={selCats}
                        selSubs={selSubs}
                        onToggleCat={(id) => toggle(selCats, setSelCats, id)}
                        onToggleSub={(id) => toggle(selSubs, setSelSubs, id)}
                        onClear={clearFilters}
                        onClose={() => setFilterOpen(false)}
                        />
            )}
    </div>
  )
}

