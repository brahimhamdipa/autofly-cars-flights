import { useEffect, useRef, useState } from 'react'
import { useCart } from '../lib/CartContext'

// Shared submenu for the whole Shopping area — same look and behavior as
// the Cars / Flights menus. "My Cart" carries the live cart item count.
// Five links only: My Cart, Products, Stores, Contact Us, Seller login.
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

  const pick = (page, param) => { setOpen(false); if (go) go(page, param) }

  return (
    <div className="car-submenu-wrap" ref={ref}>
      <button className="car-submenu-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Shopping menu">
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      {open && (
        <div className="car-submenu">
          <button onClick={() => pick('grocery-cart')}>My Cart {count > 0 && <span className="menu-count">{count}</span>}</button>
          <button onClick={() => pick('products')}>Products</button>
          <button onClick={() => pick('stores')}>Stores</button>
          <button onClick={() => pick('grocery-contact')}>Contact Us</button>
          <button onClick={() => pick('shop-seller')}>Seller login</button>
        </div>
      )}
    </div>
  )
}

// Top bar for every Shopping-area page: submenu button on the left,
// cart icon with the live item count on the right.
export function GroceryTopBar({ go }) {
  const { count } = useCart()
  return (
    <div className="g-topbar">
      <GroceryMenu go={go} />
      <button className="cart-fab" onClick={() => go && go('grocery-cart')} aria-label="My Cart">
        🛒{count > 0 && <span className="cart-fab-count">{count}</span>}
      </button>
    </div>
  )
}
