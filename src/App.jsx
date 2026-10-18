import { useState } from 'react'
import CarSection from './components/CarSection'
import FlightSection from './components/FlightSection'
import './index.css'

export default function App() {
  const [tab, setTab] = useState('cars')
  return (
    <div className="app">
      <header className="header">
        <div className="logo">🚗 AutoFly ✈️</div>
        <nav>
          <button className={tab === 'cars' ? 'active' : ''} onClick={() => setTab('cars')}>Cars</button>
          <button className={tab === 'flights' ? 'active' : ''} onClick={() => setTab('flights')}>Flights</button>
        </nav>
      </header>
      <main className="main">
        {tab === 'cars' ? <CarSection /> : <FlightSection />}
      </main>
      <footer className="footer">
        <p>AutoFly — Cars & Flights in one simple place. All submissions are saved to Supabase and emailed to brahimhamdipa@gmail.com</p>
      </footer>
    </div>
  )
}
