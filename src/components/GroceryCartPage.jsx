import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useCart } from '../lib/CartContext'
import { GroceryTopBar } from './GroceryMenu'
import CartCheckout from './CartCheckout'

// My Cart page — the exact same cart/checkout as the "Your cart" section on
// the Groceries shop page (shared CartCheckout component + shared cart).
export default function GroceryCartPage({ go }) {
  const { count, lastOrder } = useCart()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const loadProducts = async () => {
    const { data, error } = await supabase
      .from('grocery_products')
      .select('*')
      .eq('is_available', true)
      .order('sort_order')
      .order('name')
    if (error) setLoadError(error.message)
    else setProducts(data || [])
    setLoading(false)
  }
  useEffect(() => { loadProducts() }, [])

  return (
    <div>
      <GroceryTopBar go={go} />
      <div className="hero-card">
        <h2>🛒 My Cart</h2>
        <p>Everything you've added from the Groceries shop is here. Choose delivery or pickup, send your order, and we'll take it from there.</p>
      </div>
      {loading && <div className="hero-card"><p>Loading your cart...</p></div>}
      {loadError && <div className="hero-card"><p>Couldn't load your cart: {loadError}</p></div>}
      {!loading && !loadError && count === 0 && !lastOrder && (
        <div className="hero-card">
          <p>Your cart is empty.</p>
          <button onClick={() => go && go('groceries')}>Browse Groceries</button>
        </div>
      )}
      {!loading && !loadError && (count > 0 || lastOrder) && (
        <CartCheckout products={products} onOrderPlaced={loadProducts} />
      )}
    </div>
  )
}
