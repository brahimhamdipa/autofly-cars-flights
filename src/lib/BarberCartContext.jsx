import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// The barber-website cart — DELIBERATELY SEPARATE from the shopping
// cart (CartContext, 'autofly-grocery-cart'). The shopping checkout
// (place_store_order / place_store_hold_order) can only process store
// items, never a website plan, so mixing the two would strand a
// website order with nowhere to go. This cart holds exactly one
// product: the barber website plan, $10/month, under the key
// 'b:website'. It lives in its own localStorage key so the two carts
// never interfere, and the Barbers submenu / cart icon read from it
// the same way the Shopping ones read from the shopping cart.
const BarberCartCtx = createContext(null)

const STORAGE_KEY = 'autofly-barber-cart'

export const BARBER_PLAN_KEY = 'b:website'
export const BARBER_PLAN_NAME = 'Barber website'
export const BARBER_PLAN_PRICE = 10

export function BarberCartProvider({ children }) {
  // lastOrder survives the cart being cleared, so the order
  // confirmation stays on screen after checkout (same pattern as the
  // shopping cart's lastOrder).
  const [lastOrder, setLastOrder] = useState(null)
  const [cart, setCartState] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      const qty = Number(raw[BARBER_PLAN_KEY]) || 0
      return qty > 0 ? { [BARBER_PLAN_KEY]: 1 } : {}
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
  const addWebsite = () => {
    setLastOrder(null)
    setCartState({ [BARBER_PLAN_KEY]: 1 })
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
    <BarberCartCtx.Provider value={{ cart, count, addWebsite, setQty, clearCart, lastOrder, setLastOrder }}>
      {children}
    </BarberCartCtx.Provider>
  )
}

export function useBarberCart() {
  const ctx = useContext(BarberCartCtx)
  if (!ctx) throw new Error('useBarberCart must be used inside BarberCartProvider')
  return ctx
}
