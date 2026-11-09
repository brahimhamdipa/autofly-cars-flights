import { useEffect, useRef, useState } from 'react'
import { useBusinessCart } from '../lib/BusinessCartContext'

// Shared submenu for ALL Yently Kids pages — same look and behavior
// as the Business Systems menu (white circular button, plain list).
// Twelve links: My Cart (with the live business-cart count),
// Yently Kids (the hub page), the nine subjects, and Books for
// Kids (coming soon). One cart serves the whole Yently site, so the
// Kids pages share the Business Systems cart — every plan counts
// toward the same bundle discount.
export default function KidsMenu({ go }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const { count } = useBusinessCart()

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const pick = (page, param) => { setOpen(false); if (go) go(page, param) }

  return (
    <div className="car-submenu-wrap" ref={ref}>
      <button className="car-submenu-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Yently Kids menu">
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      {open && (
        <div className="car-submenu">
          <button onClick={() => pick('business-cart')}>My Cart {count > 0 && <span className="menu-count">{count}</span>}</button>
          <button onClick={() => pick('kids-hub')}>Yently Kids</button>
          <button onClick={() => pick('kids-math')}>Math</button>
          <button onClick={() => pick('kids-english')}>English</button>
          <button onClick={() => pick('kids-arabic')}>Arabic</button>
          <button onClick={() => pick('kids-french')}>French</button>
          <button onClick={() => pick('kids-spanish')}>Spanish</button>
          <button onClick={() => pick('kids-science')}>Science</button>
          <button onClick={() => pick('kids-geography')}>Geography</button>
          <button onClick={() => pick('kids-coding')}>Coding</button>
          <button onClick={() => pick('kids-reading')}>Reading</button>
          <button onClick={() => pick('kids-books')}>Books for Kids</button>
        </div>
      )}
    </div>
  )
}

// Top bar for every Yently Kids page: submenu button on the left,
// cart icon with the live item count on the right (badge hidden at 0,
// same rule as the other top bars).
export function KidsTopBar({ go }) {
  const { count } = useBusinessCart()
  return (
    <div className="g-topbar">
      <KidsMenu go={go} />
      <button className="cart-fab" onClick={() => go && go('business-cart')} aria-label="My Cart">
        🛒{count > 0 && <span className="cart-fab-count">{count}</span>}
      </button>
    </div>
  )
}
