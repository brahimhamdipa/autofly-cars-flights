import { useEffect, useRef, useState } from 'react'
import { useDealerCart } from '../lib/DealerCartContext'

// Shared submenu for the Dealer area — same look and behavior
// as the Shopping / Cars / Flights / Barbers / Restaurants menus
// (white circular button, plain list). Four links: My Cart (with the
// live dealer-cart count), Dealer, Restaurants, POS. Mirrors
// RestaurantsMenu exactly, reading the separate dealer cart instead
// of the restaurant cart.
export default function DealerMenu({ go }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { count } = useDealerCart()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const pick = (page, param) => { setOpen(false); if (go) go(page, param) }

  return (
    <div className="car-submenu-wrap" ref={ref}>
      <button className="car-submenu-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Dealer menu">
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      {open && (
        <div className="car-submenu">
          <button onClick={() => pick('dealer-cart')}>My Cart {count > 0 && <span className="menu-count">{count}</span>}</button>
          <button onClick={() => pick('dealer')}>Dealer</button>
          <button onClick={() => pick('restaurants')}>Restaurants</button>
          <button onClick={() => pick('pos')}>POS</button>
        </div>
      )}
    </div>
  )
}

// Top bar for every Dealer-area page: submenu button on the
// left, cart icon with the live item count on the right (badge hidden
// at 0, same rule as the Shopping top bar).
export function DealerTopBar({ go }) {
  const { count } = useDealerCart()
  return (
    <div className="g-topbar">
      <DealerMenu go={go} />
      <button className="cart-fab" onClick={() => go && go('dealer-cart')} aria-label="My Cart">
        🛒{count > 0 && <span className="cart-fab-count">{count}</span>}
      </button>
    </div>
  )
}
