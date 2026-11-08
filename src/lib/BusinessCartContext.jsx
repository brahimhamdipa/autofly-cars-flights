import { createContext, useContext, useEffect, useState } from 'react'

// The ONE cart for all Business Systems website plans — this REPLACES
// the seven separate website carts:
//   'autofly-restaurant-cart' (RestaurantCartContext, 'r:website')
//   'autofly-pos-cart' (PosCartContext, 'p:website')
//   'autofly-dealer-cart' (DealerCartContext, 'd:website')
//   'autofly-employee-cart' (EmployeeCartContext, 'e:website')
//   'autofly-bodyshop-cart' (BodyshopCartContext, 'bs:website')
//   'autofly-barber-cart' (BarberCartContext, 'b:website')
//   (the barbershop booking page, 'bb:website', never had a cart)
// One shared "My Cart" now serves every Business Systems page, because
// they are all the same kind of product: a website page AutoFly builds
// for a business. Checkout still inserts one row per plan into that
// plan's own order table and emails the owner once per plan — the
// tables and the follow-ups are unchanged, only the cart is shared.
//
// The shopping cart (CartContext, 'autofly-grocery-cart') stays
// separate on purpose: its checkout can only process store items,
// never a website plan, so mixing them would strand a website order
// with nowhere to go. No payment is taken here — placing the order
// inserts the order rows and emails the owner, who then sets each
// page up. Connecting carts to the bank comes later.
//
// The cart is an array of {key, name, price} — one of each plan max.
// A website plan is one line, quantity 1: buying it twice is two
// separate orders, not quantity 2 of one site.
const BusinessCartCtx = createContext(null)

const STORAGE_KEY = 'autofly-business-cart'

export const RESTAURANT_PLAN_KEY = 'r:website'
export const RESTAURANT_PLAN_NAME = 'Restaurant ordering page'
export const RESTAURANT_PLAN_PRICE = 20

export const POS_PLAN_KEY = 'p:website'
export const POS_PLAN_NAME = 'Point of sale page'
export const POS_PLAN_PRICE = 29

export const BARBERSHOP_PLAN_KEY = 'bb:website'
export const BARBERSHOP_PLAN_NAME = 'Barbershop booking page'
export const BARBERSHOP_PLAN_PRICE = 15

export const DEALER_PLAN_KEY = 'd:website'
export const DEALER_PLAN_NAME = 'Dealer website'
export const DEALER_PLAN_PRICE = 20

export const EMPLOYEE_PLAN_KEY = 'e:website'
export const EMPLOYEE_PLAN_NAME = 'Employee time page'
export const EMPLOYEE_PLAN_PRICE = 20

export const BODYSHOP_PLAN_KEY = 'bs:website'
export const BODYSHOP_PLAN_NAME = 'Bodyshop management'
export const BODYSHOP_PLAN_PRICE = 20

export const SAMPLE_PLAN_KEY = 'b:website'
export const SAMPLE_PLAN_NAME = 'Sample website'
export const SAMPLE_PLAN_PRICE = 10

export const TV_PLAN_KEY = 'tv:website'
export const TV_PLAN_NAME = 'TV Gallery page'
export const TV_PLAN_PRICE = 2

// Single source of truth for the eight plans, keyed by plan key.
export const BUSINESS_PLANS = {
  [RESTAURANT_PLAN_KEY]: { key: RESTAURANT_PLAN_KEY, name: RESTAURANT_PLAN_NAME, price: RESTAURANT_PLAN_PRICE },
  [POS_PLAN_KEY]: { key: POS_PLAN_KEY, name: POS_PLAN_NAME, price: POS_PLAN_PRICE },
  [BARBERSHOP_PLAN_KEY]: { key: BARBERSHOP_PLAN_KEY, name: BARBERSHOP_PLAN_NAME, price: BARBERSHOP_PLAN_PRICE },
  [DEALER_PLAN_KEY]: { key: DEALER_PLAN_KEY, name: DEALER_PLAN_NAME, price: DEALER_PLAN_PRICE },
  [EMPLOYEE_PLAN_KEY]: { key: EMPLOYEE_PLAN_KEY, name: EMPLOYEE_PLAN_NAME, price: EMPLOYEE_PLAN_PRICE },
  [BODYSHOP_PLAN_KEY]: { key: BODYSHOP_PLAN_KEY, name: BODYSHOP_PLAN_NAME, price: BODYSHOP_PLAN_PRICE },
  [SAMPLE_PLAN_KEY]: { key: SAMPLE_PLAN_KEY, name: SAMPLE_PLAN_NAME, price: SAMPLE_PLAN_PRICE },
  [TV_PLAN_KEY]: { key: TV_PLAN_KEY, name: TV_PLAN_NAME, price: TV_PLAN_PRICE },
}

export function BusinessCartProvider({ children }) {
  // lastOrder survives the cart being cleared, so the order
  // confirmation stays on screen after checkout (same pattern as the
  // shopping cart's lastOrder).
  const [lastOrder, setLastOrder] = useState(null)
  const [cart, setCartState] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY))
      if (!Array.isArray(raw)) return []
      // Keep only known plans, one of each max; rebuild each line from
      // BUSINESS_PLANS so a stale stored name or price never survives.
      const seen = new Set()
      const items = []
      for (const i of raw) {
        if (!i || !BUSINESS_PLANS[i.key] || seen.has(i.key)) continue
        seen.add(i.key)
        const plan = BUSINESS_PLANS[i.key]
        items.push({ key: plan.key, name: plan.name, price: plan.price })
      }
      return items
    } catch {
      return []
    }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cart)) } catch { /* ignore */ }
  }, [cart])

  const count = cart.length

  // Adding a plan already in the cart is a no-op — one of each max.
  const addPlan = (key) => {
    const plan = BUSINESS_PLANS[key]
    if (!plan) return
    setLastOrder(null)
    setCartState(c => (c.some(i => i.key === key) ? c : [...c, { key: plan.key, name: plan.name, price: plan.price }]))
  }

  const removePlan = (key) => setCartState(c => c.filter(i => i.key !== key))

  const hasPlan = (key) => cart.some(i => i.key === key)

  const clearCart = () => setCartState([])

  return (
    <BusinessCartCtx.Provider value={{ cart, count, addPlan, removePlan, hasPlan, clearCart, lastOrder, setLastOrder }}>
      {children}
    </BusinessCartCtx.Provider>
  )
}

export function useBusinessCart() {
  const ctx = useContext(BusinessCartCtx)
  if (!ctx) throw new Error('useBusinessCart must be used inside BusinessCartProvider')
  return ctx
}
