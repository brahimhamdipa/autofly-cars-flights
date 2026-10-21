import { useEffect, useRef, useState } from 'react'
import { useCart } from '../lib/CartContext'

// Shared submenu for the whole Groceries area — same look and behavior as
// the Cars / Flights menus. "My Cart" carries the live cart item count.
export default function GroceryMenu({ go }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { count } = useCart()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open ])

  const pick = (page) => { setOpen(false); if (go) go(page) }

  return (
    <div className="car-submenu-wrap" ref={ref}>
      <button className="car-submenu-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Groceries menu">
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      {open && (
        <div className="car-submenu">
          <button onClick={() => pick('grocery-cart')}>My Cart <span className="menu-count">{count}</span></button>
          <button onClick={() => pick('groceries')}>Groceries</button>
          <button onClick={() => pick('lunches')}>Lunches/Snacks</button>
          <button onClick={() => pick('meats')}>Meats</button>
          <button onClick={() => pick('grocery-contact')}>Contact Us</button>
        </div>
      )}
    </div>
  )
}

// Top bar for every Groceries-area page: submenu button on the left,
// cart icon with the live item count on the right.
export function GroceryTopBar({ go }) {
  const { count } = useCart()
  return (
    <div className="g-topbar">
      <GroceryMenu go={go} />
      <button className="cart-fab" onClick={() => go && go('grocery-cart')} aria-label="My Cart">
        🛒<span className="cart-fab-count">{count}</span>
      </button>
    </div>
  )
}
