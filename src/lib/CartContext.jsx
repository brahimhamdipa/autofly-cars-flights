import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// The ONE cart for the whole site (shop page, My Cart page, submenu
// badge, top-right cart icon). It holds grocery products AND store items
// together, grouped into sections by store at checkout time — nothing
// is ever lost by mixing, because each line knows where it came from.
//
// Cart shape: { key: qty } where key is 'g:<grocery product id>' or
// 's:<store item id>'. Older saved carts used bare product ids; those
// are migrated to 'g:' keys on load, so nobody loses their cart.
const CartCtx = createContext(null)
const STORAGE_KEY = 'autofly-grocery-cart'

function migrate(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out = {}
  for (const [k, v] of Object.entries(raw)) {
    const qty = Number(v) || 0
    if (qty <= 0) continue
    if (k.startsWith('g:') || k.startsWith('s:')) out[k] = qty
    else out['g:' + k] = qty // legacy bare grocery id
  }
  return out
}

export function CartProvider({ children }) {
  // lastOrder survives the cart being cleared, so order confirmations
  // stay on screen even when the checkout component would otherwise
  // unmount (e.g. the My Cart page hides it for an empty cart). It is a
  // LIST of placed section receipts (one per store / grocery order).
  const [lastOrder, setLastOrder] = useState(null)
  const [cart, setCartState] = useState(() => {
    try {
      return migrate(JSON.parse(localStorage.getItem(STORAGE_KEY)))
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

  const add = (key, qty, max) => {
    setLastOrder(null)
    setCartState(c => {
      const next = (c[key] || 0) + qty
      return { ...c, [key]: max ? Math.min(max, next) : next }
    })
  }

  // Grocery product (from the Online Store grid).
  const addGrocery = (product, qty) => add('g:' + product.id, qty, product.stock)
  // Store item (from any store / category / detail page). A null stock
  // means "not tracked" (e.g. services) — no quantity cap.
  const addStore = (item, qty = 1) => add('s:' + item.id, qty, item.stock ?? undefined)

  const setQty = (key, qty, max) =>
    setCartState(c => {
      const next = { ...c }
      if (!qty || qty <= 0) delete next[key]
      else next[key] = max ? Math.min(max, qty) : qty
      return next
    })

  const clearCart = () => setCartState({})
  const removeSection = (keys) =>
    setCartState(c => {
      const next = { ...c }
      keys.forEach(k => delete next[k])
      return next
    })

  return (
    <CartCtx.Provider value={{ cart, count, add, addGrocery, addStore, setQty, clearCart, removeSection, lastOrder, setLastOrder }}>
      {children}
    </CartCtx.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartCtx)
  if (!ctx) throw new Error('useCart must be used inside CartProvider')
  return ctx
}
