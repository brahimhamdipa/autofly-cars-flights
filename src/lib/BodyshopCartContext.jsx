import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// The bodyshop-management cart — DELIBERATELY SEPARATE from the
// shopping cart (CartContext, 'autofly-grocery-cart'), from the
// barber cart ('autofly-barber-cart'), from the restaurant cart
// ('autofly-restaurant-cart'), from the POS cart and from the dealer
// cart ('autofly-dealer-cart'). The shopping checkout can only
// process store items, never a website plan, so mixing them would
// strand a website order with nowhere to go. This cart holds exactly
// one product: the bodyshop management plan, $20/month, under the
// key 'bs:website'. It lives in its own localStorage key so the carts
// never interfere, and the Bodyshop submenu / cart icon read from it
// the same way the Dealer ones read from the dealer cart. No payment
// is taken here — placing the order inserts a bodyshop_order row and
// emails the owner, who then sets the bodyshop up. Connecting carts
// to the bank comes later.
const BodyshopCartCtx = createContext(null)

const STORAGE_KEY = 'autofly-bodyshop-cart'

export const BODYSHOP_PLAN_KEY = 'bs:website'
export const BODYSHOP_PLAN_NAME = 'Bodyshop management'
export const BODYSHOP_PLAN_PRICE = 20

export function BodyshopCartProvider({ children }) {
  // lastOrder survives the cart being cleared, so the order
  // confirmation stays on screen after checkout (same pattern as the
  // shopping cart's lastOrder).
  const [lastOrder, setLastOrder] = useState(null)
  const [cart, setCartState] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      const qty = Number(raw[BODYSHOP_PLAN_KEY]) || 0
      return qty > 0 ? { [BODYSHOP_PLAN_KEY]: 1 } : {}
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
    setCartState({ [BODYSHOP_PLAN_KEY]: 1 })
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
    <BodyshopCartCtx.Provider value={{ cart, count, addPlan, setQty, clearCart, lastOrder, setLastOrder }}>
      {children}
    </BodyshopCartCtx.Provider>
  )
}

export function useBodyshopCart() {
  const ctx = useContext(BodyshopCartCtx)
  if (!ctx) throw new Error('useBodyshopCart must be used inside BodyshopCartProvider')
  return ctx
}
