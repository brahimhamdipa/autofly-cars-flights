import { useEffect, useMemo, useState } from 'react'
import { Lightbox } from './CarSection'
import { GroceryTopBar } from './GroceryMenu'
import { loadItems, loadCategories, money } from '../lib/storeData'

// Category page: every submenu category link queries the Items table
// filtered by category (and only active items). Each item shows its store,
// and leads back to that store's page or its "Order from us" page —
// there is deliberately no cart here, so carts never mix providers.
export default function CategoryPage({ slug, go }) {
  const [category, setCategory] = useState(null)
  const [items, setItems] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    setCategory(null); setItems(null); setError('')
    loadCategories()
      .then(cats => cats.find(c => c.slug === slug) || null)
      .then(cat => {
        setCategory(cat)
        if (cat) return loadItems({ categorySlug: slug })
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
      [i.name, i.description, String(i.price), i.provider?.name, i.provider?.country, i.provider?.city]
        .join(' ').toLowerCase().includes(needle)
    )
  }, [items, query])

  return (
    <div>
      <GroceryTopBar go={go} />

      <div className="hero-card">
        <h2>{category ? category.name : 'Category'}</h2>
        <p>Items in this category, from all stores. Search by name, price, store or country.</p>
        <div className="filters">
          <input placeholder="Search items (e.g. lamb, 22, Morocco)" value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {items && <p className="hint">{filtered.length} item{filtered.length === 1 ? '' : 's'} found</p>}
      </div>

      {error && (
        <div className="hero-card"><p>Couldn't load items: {error}. If the store tables are not set up yet, run <b>supabase/store-tables.sql</b> in the Supabase SQL editor.</p></div>
      )}
      {!error && items === null && <div className="hero-card"><p>Loading items...</p></div>}
      {!error && category === null && items !== null && (
        <div className="hero-card"><p>Unknown category. Pick one from the submenu.</p></div>
      )}
      {!error && items && filtered.length === 0 && category && (
        <div className="hero-card"><p>No items in this category yet — add some from Admin.</p></div>
      )}

      <div className="grid">
        {filtered.map(item => {
          const images = item.pics || []
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
                <h3>{item.name}</h3>
                <p className="price">{money(item.price)}</p>
                {item.description && <p className="car-desc">{item.description}</p>}
                {item.provider && <p className="hint">🏬 {item.provider.name}{item.provider.country ? ` · ${item.provider.country}` : ''}</p>}
                <p className="item-badges">
                  {item.delivery && <span className="badge">🚚 Delivery</span>}
                  {item.pickup && <span className="badge">🏪 Pickup</span>}
                </p>
                <div className="item-actions">
                  <button onClick={() => go('store-detail', item.provider_id)}>Shop with us</button>
                  <button className="btn-soft" onClick={() => go('store-order', item.provider_id)}>Order from this store</button>
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
