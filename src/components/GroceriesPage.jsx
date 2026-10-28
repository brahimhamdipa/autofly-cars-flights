import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCart } from '../lib/CartContext'
import { GroceryTopBar } from './GroceryMenu'
import CartCheckout, { money } from './CartCheckout'
import { loadItems } from '../lib/storeData'
import { StockLine, CardSlideshow } from './StoreBits'

// Accent-insensitive text match helper (same idea as the Cars picker).
const norm = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

// Online Store page: ONLY the store items flagged for online sale
// ("From our stores — also available online"). The old grocery grid
// ("Groceries & fresh fish") was removed from this page on purpose —
// the grocery products table, the Products & Stock admin section and
// grocery orders are all untouched, and items already in a cart still
// check out fine (the cart below still resolves grocery products).
// Each card has Add to cart, View details, and — like the category
// pages — a "Shop with us" button opening that store's order page
// (all its products, with search).
export default function GroceriesPage({ go }) {
  const [products, setProducts] = useState([])
  const [onlineItems, setOnlineItems] = useState([])
  const [onlineQuery, setOnlineQuery] = useState('')
  const { addStore } = useCart()

  // Grocery products are still loaded, but only so the shared cart can
  // resolve grocery lines already in it — they are no longer listed here.
  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('grocery_products')
      .select('*')
      .eq('display', true)
      .order('sort_order')
      .order('name')
    if (!error) setProducts(data || [])
  }
  useEffect(() => { loadProducts() }, [])
  useEffect(() => {
    loadItems({ onlineFilter: true }).then(setOnlineItems).catch(() => {})
  }, [])

  const oq = norm(onlineQuery.trim())
  const visibleOnline = onlineItems.filter(i =>
    !oq || norm(i.name).includes(oq) || norm(i.provider?.name).includes(oq)
  )

  return (
    <div>
      <GroceryTopBar go={go} />
      <div className="hero-card">
        <span className="tag">Now Open</span>
        <h2>🛍️ Online Store</h2>
        <p>Items from our physical stores, sold online here. Tap a picture for a fullscreen slideshow, View details for the full item page, add items to your cart, and check out per store — delivery or pickup, just like in the shop.</p>
        <div className="filters">
          <input placeholder="Search store items (e.g. bread, Paris)" value={onlineQuery} onChange={e => setOnlineQuery(e.target.value)} />
        </div>
        {onlineItems.length > 0 && <p className="hint">{visibleOnline.length} item{visibleOnline.length === 1 ? '' : 's'}</p>}
      </div>

      {onlineItems.length === 0 && (
        <div className="hero-card"><p>No store items are flagged for online sale yet — tick "Sell this item on the Online Store" on an item in Admin.</p></div>
      )}
      {onlineItems.length > 0 && visibleOnline.length === 0 && (
        <div className="hero-card"><p>No items match your search. Try a different name.</p></div>
      )}

      <div className="grid">
        {visibleOnline.map(item => {
          const images = item.pics || []
          const out = item.stock !== null && item.stock !== undefined && item.stock <= 0
          return (
            <div className="card g-card" key={item.id}>
              <CardSlideshow images={images} name={item.name} />
              <div className="card-body">
                <h3 className="clickable-title" onClick={() => go('item-detail', item.id)}>{item.name}</h3>
                <StockLine stock={item.stock} />
                {item.description && <p className="car-desc desc-clamp">{item.description}</p>}
                <p className="g-price">{money(item.price)}</p>
                {item.provider && <p className="hint">🏬 {item.provider.name}{item.provider.country ? ` · ${item.provider.country}` : ''}</p>}
                <p className="item-badges">
                  {item.delivery && <span className="badge">🚚 Delivery</span>}
                  {item.pickup && <span className="badge">🏪 Pickup</span>}
                </p>
                <div className="item-actions">
                  <button type="button" disabled={out} onClick={() => addStore(item)}>
                    {out ? 'Out of stock' : 'Add to cart'}
                  </button>
                  <button type="button" className="btn-soft" onClick={() => go('item-detail', item.id)}>View details →</button>
                  <button type="button" className="btn-soft" onClick={() => go('store-order', item.provider_id)}>Shop with us</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Same shared cart/checkout as the My Cart page — kept here too. */}
      <CartCheckout products={products} onOrderPlaced={loadProducts} />
    </div>
  )
}
