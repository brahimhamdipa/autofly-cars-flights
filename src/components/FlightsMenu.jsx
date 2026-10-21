import { useEffect, useRef, useState } from 'react'

// Shared submenu for the Flights area — same style/role as the Cars submenu.
// Shown at the top-left of the Flights main page (Flight Estimation) and of
// the Flight Reservation page. Reuses the shared submenu styles.
export default function FlightsMenu({ go }) {
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
      <button className="car-submenu-btn" onClick={() => setOpen(o => !o)} aria-haspopup="true" aria-expanded={open} aria-label="Flights menu">
        <span className="burger" aria-hidden="true"><span /><span /><span /></span>
      </button>
      {open && (
        <div className="car-submenu">
          <button onClick={() => pick('flights')}>Flight Estimation</button>
          <button onClick={() => pick('reserve')}>Flight Reservation</button>
        </div>
      )}
    </div>
  )
}
