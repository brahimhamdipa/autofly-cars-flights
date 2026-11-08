import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// The dealer-website cart — DELIBERATELY SEPARATE from the
// shopping cart (CartContext, 'autofly-grocery-cart'), from the
// barber cart ('autofly-barber-cart'), from the restaurant cart
// ('autofly-restaurant-cart') and from the POS cart. The shopping
// checkout can only process store items, never a website plan, so
// mixing them would strand a website order with nowhere to go.
// This cart holds exactly one product: the dealer website plan,
// $20/month, under the key 'd:website'. It lives in its own
// localStorage key so the carts never interfere, and the Dealer
// submenu / cart icon read from it the same way the Restaurants
// ones read from the restaurant cart. No payment is taken here —
// placing the order inserts a dealer_order row and emails the
// owner, who then sets the dealership up. Connecting carts to the
// bank comes later.
const DealerCartCtx = createContext(null)

const STORAGE_KEY = 'autofly-dealer-cart'

export const DEALER_PLAN_KEY = 'd:website'
export const DEALER_PLAN_NAME = 'Dealer website'
export const DEALER_PLAN_PRICE = 20

export function DealerCartProvider({ children }) {
  // lastOrder survives the cart being cleared, so the order
  // confirmation stays on screen after checkout (same pattern as the
  // shopping cart's lastOrder).
  const [lastOrder, setLastOrder] = useState(null)
  const [cart, setCartState] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      const qty = Number(raw[DEALER_PLAN_KEY]) || 0
      return qty > 0 ? { [DEALER_PLAN_KEY]: 1 } : {}
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

  // A website plan is one line, quantity 1 — buying it twice is two
  // separate orders, not quantity 2 of one site.
  const addPlan = () => {
    setLastOrder(null)
    setCartState({ [DEALER_PLAN_KEY]: 1 })
  }

  const setQty = (key, qty) =>
    setCartState(c => {
      const next = { ...c }
      if (!qty || qty <= 0) delete next[key]
      else next[key] = qty
      return next
    })

  const clearCart = () => setCartState({})

  return (
    <DealerCartCtx.Provider value={{ cart, count, addPlan, setQty, clearCart, lastOrder, setLastOrder }}>
      {children}
    </DealerCartCtx.Provider>
  )
}

export function useDealerCart() {
  const ctx = useContext(DealerCartCtx)
  if (!ctx) throw new Error('useDealerCart must be used inside DealerCartProvider')
  return ctx
}
