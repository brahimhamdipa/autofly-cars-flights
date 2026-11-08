import { useEffect, useRef, useState } from 'react'
import { useEmployeeCart } from '../lib/EmployeeCartContext'

// Shared submenu for the Employee area — same look and behavior
// as the Shopping / Cars / Flights / Barbers / Restaurants / Dealer
// menus (white circular button, plain list). Four links: My Cart
// (with the live employee-cart count), Employee, Restaurants, POS.
// Mirrors DealerMenu exactly, reading the separate employee cart
// instead of the dealer cart.
export default function EmployeeMenu({ go }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { count } = useEmployeeCart()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const pick = (page, param) => { setOpen(false); if (go) go(page, param) }

  return (
    <div className="car-submenu-wrap" ref={ref}>
      <button className="car-submenu-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Employee menu">
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      {open && (
        <div className="car-submenu">
          <button onClick={() => pick('employee-cart')}>My Cart {count > 0 && <span className="menu-count">{count}</span>}</button>
          <button onClick={() => pick('employee')}>Employee</button>
          <button onClick={() => pick('restaurants')}>Restaurants</button>
          <button onClick={() => pick('pos')}>POS</button>
        </div>
      )}
    </div>
  )
}

// Top bar for every Employee-area page: submenu button on the
// left, cart icon with the live item count on the right (badge hidden
// at 0, same rule as the Shopping top bar).
export function EmployeeTopBar({ go }) {
  const { count } = useEmployeeCart()
  return (
    <div className="g-topbar">
      <EmployeeMenu go={go} />
      <button className="cart-fab" onClick={() => go && go('employee-cart')} aria-label="My Cart">
        🛒{count > 0 && <span className="cart-fab-count">{count}</span>}
      </button>
    </div>
  )
}
