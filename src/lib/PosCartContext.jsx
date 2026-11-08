import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// The point-of-sale-page cart — DELIBERATELY SEPARATE from the
// shopping cart (CartContext, 'autofly-grocery-cart'), from the
// barber cart ('autofly-barber-cart') and from the restaurant cart
// ('autofly-restaurant-cart'). The shopping checkout can only
// process store items, never a website plan, so mixing them would
// strand a website order with nowhere to go; and each website plan
// (barber, restaurant, point of sale) is a different product with a
// different follow-up, so fusing the website carts would tangle the
// orders too. This cart holds exactly one product: the point of sale
// page plan, $29/month, under the key 'p:website'. It lives in its
// own localStorage key so the carts never interfere, and the POS
// submenu / cart icon read from it the same way the Restaurants ones
// read from the restaurant cart. No payment is taken here — placing
// the order inserts a pos_order row and emails the owner, who then
// sets the store up. Connecting carts to the bank comes later.
const PosCartCtx = createContext(null)

const STORAGE_KEY = 'autofly-pos-cart'

export const POS_PLAN_KEY = 'p:website'
export const POS_PLAN_NAME = 'Point of sale page'
export const POS_PLAN_PRICE = 29

export function PosCartProvider({ children }) {
  // lastOrder survives the cart being cleared, so the order
  // confirmation stays on screen after checkout (same pattern as the
  // shopping cart's lastOrder).
  const [lastOrder, setLastOrder] = useState(null)
  const [cart, setCartState] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      const qty = Number(raw[POS_PLAN_KEY]) || 0
      return qty > 0 ? { [POS_PLAN_KEY]: 1 } : {}
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
    setCartState({ [POS_PLAN_KEY]: 1 })
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
    <PosCartCtx.Provider value={{ cart, count, addPlan, setQty, clearCart, lastOrder, setLastOrder }}>
      {children}
    </PosCartCtx.Provider>
  )
}

export function usePosCart() {
  const ctx = useContext(PosCartCtx)
  if (!ctx) throw new Error('usePosCart must be used inside PosCartProvider')
  return ctx
}
