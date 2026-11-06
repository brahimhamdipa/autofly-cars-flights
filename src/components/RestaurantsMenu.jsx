import { useEffect, useRef, useState } from 'react'
import { useRestaurantCart } from '../lib/RestaurantCartContext'

// Shared submenu for the Restaurants area — same look and behavior
// as the Shopping / Cars / Flights / Barbers menus (white circular
// button, plain list). Three links: My Cart (with the live
// restaurant-cart count), Restaurants, then POS. Mirrors BarbersMenu
// exactly, reading the separate restaurant cart instead of the
// barber cart.
export default function RestaurantsMenu({ go }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { count } = useRestaurantCart()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const pick = (page, param) => { setOpen(false); if (go) go(page, param) }

  return (
    <div className="car-submenu-wrap" ref={ref}>
      <button className="car-submenu-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Restaurants menu">
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      {open && (
        <div className="car-submenu">
          <button onClick={() => pick('restaurant-cart')}>My Cart {count > 0 && <span className="menu-count">{count}</span>}</button>
          <button onClick={() => pick('restaurants')}>Restaurants</button>
          <button onClick={() => pick('pos')}>POS</button>
        </div>
      )}
    </div>
  )
}

// Top bar for every Restaurants-area page: submenu button on the
// left, cart icon with the live item count on the right (badge hidden
// at 0, same rule as the Shopping top bar).
export function RestaurantsTopBar({ go }) {
  const { count } = useRestaurantCart()
  return (
    <div className="g-topbar">
      <RestaurantsMenu go={go} />
      <button className="cart-fab" onClick={() => go && go('restaurant-cart')} aria-label="My Cart">
        🛒{count > 0 && <span className="cart-fab-count">{count}</span>}
      </button>
    </div>
  )
}
