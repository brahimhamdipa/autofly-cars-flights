import { useEffect, useRef, useState } from 'react'
import CarSection from './components/CarSection'
import FlightSection from './components/FlightSection'
import GroceriesPage from './components/GroceriesPage'
import AboutPage from './components/AboutPage'
import RentPage from './components/RentPage'
import logoUrl from './assets/logo.webp'
import './index.css'

export default function App() {
  const [tab, setTab] = useState('cars')
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const go = (t) => { setTab(t); setMoreOpen(false) }
  const inMore = tab === 'groceries' || tab === 'about'

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img className="brand-logo" src={logoUrl} alt="AutoFly.us.com" />
          <span className="tagline">Cars, Flights & More — All in One Place</span>
        </div>
        <nav>
          <button className={tab === 'cars' || tab === 'rent' ? 'active' : ''} onClick={() => go('cars')}>Cars</button>
          <button className={tab === 'flights' ? 'active' : ''} onClick={() => go('flights')}>Flights</button>
          <span className="dropdown" ref={moreRef}>
            <button className={inMore ? 'active' : ''} onClick={() => setMoreOpen(o => !o)}>More ▾</button>
            {moreOpen && (
              <span className="dropdown-menu">
                <a onClick={() => go('groceries')}>Groceries</a>
                <a onClick={() => go('about')}>About Us</a>
              </span>
            )}
          </span>
        </nav>
      </header>
      <main className="main">
        {tab === 'cars' && <CarSection onRent={() => setTab('rent')} />}
        {tab === 'rent' && <RentPage />}
        {tab === 'flights' && <FlightSection />}
        {tab === 'groceries' && <GroceriesPage />}
        {tab === 'about' && <AboutPage />}
      </main>
      <footer className="footer">
        <p>AutoFly.us.com — Cars, Flights & More — All in One Place</p>
      </footer>
    </div>
  )
}
