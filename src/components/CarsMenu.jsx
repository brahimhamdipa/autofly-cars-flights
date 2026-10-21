import { useEffect, useRef, useState } from 'react'

// Shared submenu for the whole Cars area — shown at the top-left of the
// Cars listings page and of the Rent / Sell / Test drive / Contact pages.
export default function CarsMenu({ go }) {
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
      <button className="car-submenu-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Cars menu">
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      {open && (
        <div className="car-submenu">
          <button onClick={() => pick('cars')}>Buy a Car</button>
          <button onClick={() => pick('rent')}>Rent a Car</button>
          <button onClick={() => pick('sell')}>Sell a Car</button>
          <button onClick={() => pick('testdrive')}>Info/Test drive a Car</button>
          <button onClick={() => pick('contact')}>Contact Us</button>
        </div>
      )}
    </div>
  )
}
