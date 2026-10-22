import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Lightbox } from './CarSection'
import { useCart } from '../lib/CartContext'
import { GroceryTopBar } from './GroceryMenu'
import CartCheckout, { money, priceOf } from './CartCheckout'

const CATEGORY_EMOJI = { 'Fresh Fish': '🐟', 'Produce': '🥑', 'Dairy & Eggs': '🥚', 'Bakery': '🍞' }

// Accent-insensitive text match helper (same idea as the Cars picker).
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Type-to-filter product picker — same behavior as the "Info / Test drive
// a Car" car picker: typing narrows the drop list (starts-with matches
// first), tap / arrows / Enter pick an item, and the grid filters live.
function ProductPicker({ products, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)

  const results = useMemo(() => {
    const q = norm((value || '').trim())
    if (!q) return products.slice(0, 10)
    const starts = products.filter(p => norm(p.name).startsWith(q))
    const contains = products.filter(p => !norm(p.name).startsWith(q) && norm(p.name).includes(q))
    return [...starts, ...contains].slice(0, 10)
  }, [products, value])

  const pick = (p) => {
    onChange(p.name)
    setOpen(false)
    setHighlight(-1)
  }

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pick(results[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="airport-wrap">
      <input
        placeholder="Search items (e.g. Salmon)"
        value={value}
        autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <ul className="airport-list">
          {results.map((p, i) => (
            <li
              key={p.id}
              className={i === highlight ? 'active' : ''}
              onMouseDown={e => { e.preventDefault(); pick(p) }}
            >
              <span className="airport-main">{p.name}</span>
              <span className="airport-sub">
                {[p.category || '', `${money(priceOf(p))} / ${p.unit}`, p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'].filter(Boolean).join(' — ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StockLine({ stock }) {
  if (stock <= 0) return <p className="stock out">Out of stock</p>
  if (stock <= 10) return <p className="stock low">Only {stock} left in stock</p>
  return <p className="stock ok">{stock} available in stock</p>
}

function ProductCard({ product, onAdd }) {
  const [qty, setQty] = useState(1)
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const out = product.stock <= 0
  // Multiple pictures per product (DB `images` list; falls back to the
  // legacy single image_url). Slideshow works exactly like the Cars cards.
  const gallery = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product.image_url ? [product.image_url] : [])
  const n = gallery.length
  const safeIdx = n ? idx % n : 0
  return (
    <div className="card g-card">
      <div className="g-photo">
        {n > 0 ? (
          <img src={gallery[safeIdx]} alt={product.name} onClick={() => setZoom(true)} title="Click to enlarge" />
        ) : (
          <span className="g-emoji">{CATEGORY_EMOJI[product.category] || '🛒'}</span>
        )}
        {n > 1 && (
          <>
            <button type="button" className="slide-btn prev" onClick={() => setIdx(i => (i - 1 + n) % n)} aria-label="Previous photo">‹</button>
            <button type="button" className="slide-btn next" onClick={() => setIdx(i => (i + 1) % n)} aria-label="Next photo">›</button>
            <span className="slide-count">{safeIdx + 1} / {n}</span>
          </>
        )}
      </div>
      {zoom && n > 0 && <Lightbox images={gallery} start={safeIdx} onClose={() => setZoom(false)} />}
      <div className="card-body">
        <h3>{product.name}</h3>
        <StockLine stock={product.stock} />
        {product.description && <p className="car-desc">{product.description}</p>}
        <p className="g-price">
          {product.sale_price && <span className="g-was">{money(product.price)}</span>}
          {money(priceOf(product))} <span className="g-unit">/ {product.unit}</span>
        </p>
        <div className="g-buyrow">
          <span className="qty-stepper">
            <button type="button" onClick={() => setQty(q => Math.max(1, q - 1))} aria-label="Less">−</button>
            <span>{qty}</span>
            <button type="button" onClick={() => setQty(q => Math.min(product.stock || 1, q + 1))} aria-label="More">+</button>
          </span>
          <button type="button" disabled={out} onClick={() => onAdd(product, qty)}>
            {out ? 'Out of stock' : 'Add to cart'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function GroceriesPage({ go }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [filterText, setFilterText] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const { add } = useCart()

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('grocery_products')
      .select('*')
      .eq('display', true)
      .order('sort_order')
      .order('name')
    if (error) setLoadError(error.message)
    else setProducts(data || [])
    setLoading(false)
  }
  useEffect(() => { loadProducts() }, [])

  const addToCart = (product, qty) => add(product.id, qty, product.stock)

  // Live grid filtering: name (accent-insensitive contains) + max price on
  // the effective price (sale price when there is one), same as Cars.
  const q = norm(filterText.trim())
  const cap = parseFloat(maxPrice)
  const visible = products.filter(p =>
    (!q || norm(p.name).includes(q) || norm(p.category).includes(q)) &&
    (isNaN(cap) || priceOf(p) <= cap)
  )
  const filtersActive = q !== '' || !isNaN(cap)

  return (
    <div>
      <GroceryTopBar go={go} />
      <div className="hero-card">
        <span className="tag">Now Open</span>
        <h2>Groceries & fresh fish</h2>
        <p>Fresh groceries and fresh fish in select areas across the US. Add items to your cart, choose delivery or pickup, and send your order — we handle the rest.</p>
        {!loading && !loadError && products.length > 0 && (
          <div className="filters">
            <ProductPicker products={products} value={filterText} onChange={setFilterText} />
            <input className="max-price" placeholder="Max price ($)" type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
            {filtersActive && (
              <button type="button" className="clear-filters" onClick={() => { setFilterText(''); setMaxPrice('') }}>✕ Clear</button>
            )}
          </div>
        )}
      </div>

      {loading && <div className="hero-card"><p>Loading products...</p></div>}
      {loadError && <div className="hero-card"><p>Couldn't load products: {loadError}</p></div>}
      {!loading && !loadError && products.length === 0 && (
        <div className="hero-card"><p>No products yet — check back soon.</p></div>
      )}
      {!loading && !loadError && products.length > 0 && visible.length === 0 && (
        <div className="hero-card"><p>No items match your search. Try a different name or a higher max price.</p></div>
      )}

      <div className="grid">
        {visible.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}
      </div>

      {/* Same shared cart/checkout as the My Cart page — kept here too. */}
      <CartCheckout products={products} onOrderPlaced={loadProducts} />
    </div>
  )
}
