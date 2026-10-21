import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// One shared grocery cart for the whole Groceries area (shop page, My Cart
// page, submenu badge, top-right cart icon). Persisted in the browser so it
// survives switching pages and reloads.
const CartCtx = createContext(null)
const STORAGE_KEY = 'autofly-grocery-cart'

export function CartProvider({ children }) {
  // lastOrder survives the cart being cleared, so the order confirmation
  // stays on screen even when the checkout component would otherwise
  // unmount (e.g. the My Cart page hides it for an empty cart).
  const [lastOrder, setLastOrder] = useState(null)
  const [cart, setCartState] = useState(() => {
    try {
      const v = JSON.parse(localStorage.getItem(STORAGE_KEY))
      return v && typeof v === 'object' ? v : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)) } catch { /* ignore */ }
  }, [cart])

  const count = useMemo(
    () => Object.values(cart).reduce((s, q) => s + (Number(q) || 0), 0),
    [cart]
  )

  const add = (id, qty, max) => {
    setLastOrder(null)
    setCartState(c => {
      const next = (c[id] || 0) + qty
      return { ...c, [id]: max ? Math.min(max, next) : next }
    })
  }

  const setQty = (id, qty, max) =>
    setCartState(c => {
      const next = { ...c }
      if (!qty || qty <= 0) delete next[id]
      else next[id] = max ? Math.min(max, qty) : qty
      return next
    })

  const clearCart = () => setCartState({})

  return (
    <CartCtx.Provider value={{ cart, count, add, setQty, clearCart, lastOrder, setLastOrder }}>
      {children}
    </CartCtx.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartCtx)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
