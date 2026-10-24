import { useEffect, useRef, useState } from 'react'

// Shared submenu for the whole Services area — same look and behavior as
// the Cars / Flights / Groceries menus. "Websites and Systems" and the
// main menu's "Services" link open the same page.
export default function ServicesMenu({ go }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [open])

  const pick = (page) => { setOpen(false); if (go) go(page) }

  return (
    <div className="car-submenu-wrap" ref={ref}>
      <button className="car-submenu-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Services menu">
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      {open && (
        <div className="car-submenu">
          <button onClick={() => pick('services')}>Websites and Systems</button>
          <button onClick={() => pick('services-home')}>Home Services</button>
          <button onClick={() => pick('services-business')}>Business Services</button>
          <button onClick={() => pick('services-contact')}>Contact Us</button>
        </div>
      )}
    </div>
  )
}
