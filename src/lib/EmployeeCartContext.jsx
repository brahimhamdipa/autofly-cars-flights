import { createContext, useContext, useEffect, useMemo, useState } from 'react'

// The employee-time-page cart — DELIBERATELY SEPARATE from the
// shopping cart (CartContext, 'autofly-grocery-cart'), from the
// barber cart ('autofly-barber-cart'), from the restaurant cart
// ('autofly-restaurant-cart'), from the POS cart and from the dealer
// cart ('autofly-dealer-cart'). The shopping checkout can only
// process store items, never a website plan, so mixing them would
// strand a website order with nowhere to go. This cart holds exactly
// one product: the employee time page plan, $20/month, under the key
// 'e:website'. It lives in its own localStorage key so the carts
// never interfere, and the Employee submenu / cart icon read from it
// the same way the Dealer ones read from the dealer cart. No payment
// is taken here — placing the order inserts an employee_order row
// and emails the owner, who then sets the team up. Connecting carts
// to the bank comes later.
const EmployeeCartCtx = createContext(null)

const STORAGE_KEY = 'autofly-employee-cart'

export const EMPLOYEE_PLAN_KEY = 'e:website'
export const EMPLOYEE_PLAN_NAME = 'Employee time page'
export const EMPLOYEE_PLAN_PRICE = 20

export function EmployeeCartProvider({ children }) {
  // lastOrder survives the cart being cleared, so the order
  // confirmation stays on screen after checkout (same pattern as the
  // shopping cart's lastOrder).
  const [lastOrder, setLastOrder] = useState(null)
  const [cart, setCartState] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
      const qty = Number(raw[EMPLOYEE_PLAN_KEY]) || 0
      return qty > 0 ? { [EMPLOYEE_PLAN_KEY]: 1 } : {}
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
    setCartState({ [EMPLOYEE_PLAN_KEY]: 1 })
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
    <EmployeeCartCtx.Provider value={{ cart, count, addPlan, setQty, clearCart, lastOrder, setLastOrder }}>
      {children}
    </EmployeeCartCtx.Provider>
  )
}

export function useEmployeeCart() {
  const ctx = useContext(EmployeeCartCtx)
  if (!ctx) throw new Error('useEmployeeCart must be used inside EmployeeCartProvider')
  return ctx
}
