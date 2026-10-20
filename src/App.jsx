import { useState } from 'react'
import CarSection from './components/CarSection'
import FlightSection from './components/FlightSection'
import logoUrl from './assets/logo.webp'
import './index.css'

export default function App() {
  const [tab, setTab] = useState('cars')
  return (
    <div className="app">
      <header className="header">
        <div className="brand">
          <img className="brand-logo" src={logoUrl} alt="AutoFly.us.com" />
          <span className="tagline">Cars, Flights & More — All in One Place</span>
        </div>
        <nav>
          <button className={tab === 'cars' ? 'active' : ''} onClick={() => setTab('cars')}>Cars</button>
          <button className={tab === 'flights' ? 'active' : ''} onClick={() => setTab('flights')}>Flights</button>
        </nav>
      </header>
      <main className="main">
        {tab === 'cars' ? <CarSection /> : <FlightSection />}
      </main>
      <footer className="footer">
        <p>AutoFly.us.com — Cars, Flights & More — All in One Place</p>
      </footer>
    </div>
  )
}
