import { useEffect, useRef, useState } from 'react'
import CarSection from './components/CarSection'
import FlightSection from './components/FlightSection'
import GroceriesPage from './components/GroceriesPage'
import AboutPage from './components/AboutPage'
import RentPage from './components/RentPage'
import SellPage from './components/SellPage'
import TestDrivePage from './components/TestDrivePage'
import ContactPage from './components/ContactPage'
import FlightReservationPage from './components/FlightReservationPage'
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
  const inCars = ['cars', 'rent', 'sell', 'testdrive', 'contact'].includes(tab)
  const inFlights = ['flights', 'reserve'].includes(tab)

  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img className="brand-logo" src={logoUrl} alt="AutoFly.us.com" />
          <span className="tagline">Cars, Flights & More — All in One Place</span>
        </div>
        <nav>
          <button className={inCars ? 'active' : ''} onClick={() => go('cars')}>Cars</button>
          <button className={inFlights ? 'active' : ''} onClick={() => go('flights')}>Flights</button>
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
        {tab === 'cars' && <CarSection go={go} />}
        {tab === 'rent' && <RentPage go={go} />}
        {tab === 'sell' && <SellPage go={go} />}
        {tab === 'testdrive' && <TestDrivePage go={go} />}
        {tab === 'contact' && <ContactPage go={go} />}
        {tab === 'flights' && <FlightSection go={go} />}
        {tab === 'reserve' && <FlightReservationPage go={go} />}
        {tab === 'groceries' && <GroceriesPage />}
        {tab === 'about' && <AboutPage />}
      </main>
      <footer className="footer">
        <p>AutoFly.us.com — Cars, Flights & More — All in One Place</p>
      </footer>
    </div>
  )
}
