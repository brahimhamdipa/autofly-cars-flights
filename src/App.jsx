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
import FlightContactPage from './components/FlightContactPage'
import ClothesPage from './components/ClothesPage'
import MachinesPage from './components/MachinesPage'
import GroceryCartPage from './components/GroceryCartPage'
import GrocerySoonPage from './components/GrocerySoonPage'
import GroceryContactPage from './components/GroceryContactPage'
import { CartProvider } from './lib/CartContext'
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
  const GROCERY_TABS = ['groceries', 'grocery-cart', 'lunches', 'meats', 'grocery-contact']
  const inMore = [...GROCERY_TABS, 'clothes', 'machines', 'about'].includes(tab)
  const inCars = ['cars', 'rent', 'sell', 'testdrive', 'contact'].includes(tab)
  const inFlights = ['flights', 'reserve', 'flight-contact'].includes(tab)

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
                <a onClick={() => go('clothes')}>Clothes</a>
                <a onClick={() => go('machines')}>Machines</a>
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
        {tab === 'flight-contact' && <FlightContactPage go={go} />}
        {GROCERY_TABS.includes(tab) && (
          <CartProvider>
            {tab === 'groceries' && <GroceriesPage go={go} />}
            {tab === 'grocery-cart' && <GroceryCartPage go={go} />}
            {tab === 'lunches' && (
              <GrocerySoonPage go={go} title="Lunches & Snacks" emoji="🥪" topic="Lunches/Snacks"
                intro="Quick bites, packed lunches and snacks are on the way — fresh, ready to grab, and delivered or ready for pickup like everything else in the Groceries shop."
                items={['Sandwiches & wraps made fresh', 'Salads & lunch bowls', 'Chips, nuts & trail mixes', 'Cookies & sweet treats', 'Juices & drinks']} />
            )}
            {tab === 'meats' && (
              <GrocerySoonPage go={go} title="Meats" emoji="🥩" topic="Meats"
                intro="Quality fresh meats are coming to the shop — beef, chicken, lamb and more, cut and packed to order with the same delivery and pickup options."
                items={['Fresh beef cuts', 'Chicken — whole & parts', 'Lamb & goat', 'Ground meats', 'Marinated & ready-to-cook', 'Halal options']} />
            )}
            {tab === 'grocery-contact' && <GroceryContactPage go={go} />}
          </CartProvider>
        )}
        {tab === 'clothes' && <ClothesPage />}
        {tab === 'machines' && <MachinesPage />}
        {tab === 'about' && <AboutPage />}
      </main>
      <footer className="footer">
        <p>AutoFly.us.com — Cars, Flights & More — All in One Place</p>
      </footer>
    </div>
  )
}
