import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// The restaurant-ordering-page cart — DELIBERATELY SEPARATE from the
// shopping cart (CartContext, 'autofly-grocery-cart') and from the
// barber cart ('autofly-barber-cart'). The shopping checkout can only
// process store items, never a website plan, so mixing them would
// strand a website order with nowhere to go. This cart holds exactly
// one product: the restaurant ordering page plan, $20/month, under
// the key 'r:website'. It lives in its own localStorage key so the
// carts never interfere, and the Restaurants submenu / cart icon read
// from it the same way the Barbers ones read from the barber cart.
// No payment is taken here — placing the order inserts a
// restaurant_order row and emails the owner, who then sets the
// restaurant up. Connecting carts to the bank comes later.
const RestaurantCartCtx = createContext(null)

const STORAGE_KEY = 'autofly-restaurant-cart'

export const RESTAURANT_PLAN_KEY = 'r:website'
export const RESTAURANT_PLAN_NAME = 'Restaurant ordering page'
export const RESTAURANT_PLAN_PRICE = 20

export function RestaurantCartProvider({ children }) {
  // lastOrder survives the cart being cleared, so the order
  // confirmation stays on screen after checkout (same pattern as the
  // shopping cart's lastOrder).
  const [lastOrder, setLastOrder] = useState(null)
  const [cart, setCartState] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      const qty = Number(raw[RESTAURANT_PLAN_KEY]) || 0
      return qty > 0 ? { [RESTAURANT_PLAN_KEY]: 1 } : {}
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
    setCartState({ [RESTAURANT_PLAN_KEY]: 1 })
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
    <RestaurantCartCtx.Provider value={{ cart, count, addPlan, setQty, clearCart, lastOrder, setLastOrder }}>
      {children}
    </RestaurantCartCtx.Provider>
  )
}

export function useRestaurantCart() {
  const ctx = useContext(RestaurantCartCtx)
  if (!ctx) throw new Error('useRestaurantCart must be used inside RestaurantCartProvider')
  return ctx
}
