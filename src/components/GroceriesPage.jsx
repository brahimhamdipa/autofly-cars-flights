import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Lightbox } from './CarSection'
import { useCart } from '../lib/CartContext'
import { GroceryTopBar } from './GroceryMenu'
import CartCheckout, { money, priceOf } from './CartCheckout'

const CATEGORY_EMOJI = { 'Fresh Fish': '🐟', 'Produce': '🥑', 'Dairy & Eggs': '🥚', 'Bakery': '🍞' }

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

  return (
    <div>
      <GroceryTopBar go={go} />
      <div className="hero-card">
        <span className="tag">Now Open</span>
        <h2>Groceries & fresh fish</h2>
        <p>Fresh groceries and fresh fish in select areas across the US. Add items to your cart, choose delivery or pickup, and send your order — we handle the rest.</p>
      </div>

      {loading && <div className="hero-card"><p>Loading products...</p></div>}
      {loadError && <div className="hero-card"><p>Couldn't load products: {loadError}</p></div>}
      {!loading && !loadError && products.length === 0 && (
        <div className="hero-card"><p>No products yet — check back soon.</p></div>
      )}

      <div className="grid">
        {products.map(p => <ProductCard key={p.id} product={p} onAdd={addToCart} />)}
      </div>

      {/* Same shared cart/checkout as the My Cart page — kept here too. */}
      <CartCheckout products={products} onOrderPlaced={loadProducts} />
    </div>
  )
}
