import { useEffect, useRef, useState } from 'react'
import { useBusinessCart } from '../lib/BusinessCartContext'

// Shared submenu for ALL Business Systems pages — same look and
// behavior as the Shopping / Cars / Flights menus (white circular
// button, plain list). Seven top rows: My Cart (with the live
// business-cart count), Business Systems (the hub page), Restaurant,
// POS, Barber, then two branches that open in place (like the Admin
// menu branches): "More Systems" (Dealer, Employee, Bodyshop, Sample
// Website) and "Add-ons" (TV Gallery, Live Chat, Clean Link, Direct
// Upload). Each branch button shows a right arrow when closed and a
// down arrow when open, and its links are indented like sub-items,
// same size, same plain weight — none of them bold. One cart and one
// submenu for the whole area, because every page here sells the same
// kind of product: a website page Yently builds for a business.
export default function BusinessMenu({ go }) {
  const [open, setOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [addonsOpen, setAddonsOpen] = useState(false)
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
      <button className="car-submenu-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Business Systems menu">
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      {open && (
        <div className="car-submenu">
          <button onClick={() => pick('business-cart')}>My Cart {count > 0 && <span className="menu-count">{count}</span>}</button>
          <button onClick={() => pick('business-hub')}>Business Systems</button>
          <button onClick={() => pick('restaurants')}>Restaurant</button>
          <button onClick={() => pick('pos')}>POS</button>
          <button onClick={() => pick('barbers')}>Barber</button>
          <button onClick={() => setMoreOpen(o => !o)}>More Systems {moreOpen ? '▾' : '▸'}</button>
          {moreOpen && (
            <button onClick={() => pick('dealer')} style={{ display: 'block', width: '100%', background: 'white', color: '#111827', textAlign: 'left', padding: '12px 16px 12px 32px', fontSize: '14.5px', fontWeight: '400', borderTop: '1px solid #f1f2f5' }}>Dealer</button>
          )}
          {moreOpen && (
            <button onClick={() => pick('employee')} style={{ display: 'block', width: '100%', background: 'white', color: '#111827', textAlign: 'left', padding: '12px 16px 12px 32px', fontSize: '14.5px', fontWeight: '400', borderTop: '1px solid #f1f2f5' }}>Employee</button>
          )}
          {moreOpen && (
            <button onClick={() => pick('bodyshop')} style={{ display: 'block', width: '100%', background: 'white', color: '#111827', textAlign: 'left', padding: '12px 16px 12px 32px', fontSize: '14.5px', fontWeight: '400', borderTop: '1px solid #f1f2f5' }}>Bodyshop</button>
          )}
          {moreOpen && (
            <button onClick={() => pick('simple-barbershop')} style={{ display: 'block', width: '100%', background: 'white', color: '#111827', textAlign: 'left', padding: '12px 16px 12px 32px', fontSize: '14.5px', fontWeight: '400', borderTop: '1px solid #f1f2f5' }}>Sample Website</button>
          )}
          <button onClick={() => setAddonsOpen(o => !o)}>Add-ons {addonsOpen ? '▾' : '▸'}</button>
          {addonsOpen && (
            <a href="/demo-tv-gallery" style={{ display: 'block', width: '100%', background: 'white', color: '#111827', textAlign: 'left', padding: '12px 16px 12px 32px', fontSize: '14.5px', textDecoration: 'none', borderTop: '1px solid #f1f2f5' }}>TV Gallery</a>
          )}
          {addonsOpen && (
            <a href="/demo-live-chat" style={{ display: 'block', width: '100%', background: 'white', color: '#111827', textAlign: 'left', padding: '12px 16px 12px 32px', fontSize: '14.5px', textDecoration: 'none', borderTop: '1px solid #f1f2f5' }}>Live Chat</a>
          )}
          {addonsOpen && (
            <button onClick={() => pick('clean-link')} style={{ display: 'block', width: '100%', background: 'white', color: '#111827', textAlign: 'left', padding: '12px 16px 12px 32px', fontSize: '14.5px', fontWeight: '400', borderTop: '1px solid #f1f2f5' }}>Clean Link</button>
          )}
          {addonsOpen && (
            <button onClick={() => pick('direct-upload')} style={{ display: 'block', width: '100%', background: 'white', color: '#111827', textAlign: 'left', padding: '12px 16px 12px 32px', fontSize: '14.5px', fontWeight: '400', borderTop: '1px solid #f1f2f5' }}>Direct Upload</button>
          )}
        </div>
      )}
    </div>
  )
}

// Top bar for every Business Systems page: submenu button on the
// left, cart icon with the live item count on the right (badge hidden
// at 0, same rule as the Shopping top bar).
export function BusinessTopBar({ go }) {
  const { count } = useBusinessCart()
  return (
    <div className="g-topbar">
      <BusinessMenu go={go} />
      <button className="cart-fab" onClick={() => go && go('business-cart')} aria-label="My Cart">
        🛒{count > 0 && <span className="cart-fab-count">{count}</span>}
      </button>
    </div>
  )
}
