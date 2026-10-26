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
import ServicesPage from './components/ServicesPage'
import ServicesSoonPage from './components/ServicesSoonPage'
import ServicesContactPage from './components/ServicesContactPage'
import GroceryCartPage from './components/GroceryCartPage'
import GrocerySoonPage from './components/GrocerySoonPage'
import GroceryContactPage from './components/GroceryContactPage'
import ProvidersPage from './components/ProvidersPage'
import ProviderPage from './components/ProviderPage'
import StoreOrderPage from './components/StoreOrderPage'
import CategoryPage from './components/CategoryPage'
import ItemDetailPage from './components/ItemDetailPage'
import ChatWidget from './components/ChatWidget'
import AdminPage from './components/AdminPage'
import { CartProvider } from './lib/CartContext'
import logoUrl from './assets/logo.webp'
import './index.css'

export default function App() {
  const [tab, setTab] = useState('cars')
  const [providerId, setProviderId] = useState(null)
  const [orderProviderId, setOrderProviderId] = useState(null)
  const [categorySlug, setCategorySlug] = useState(null)
  const [itemId, setItemId] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const moreRef = useRef(null)

  useEffect(() => {
    const close = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  // go(tab, param): param carries the store/category for detail, order
  // and category pages (e.g. go('store-detail', 3), go('category', 'meats')).
  const go = (t, param) => {
    if (t === 'store-detail') setProviderId(param)
    if (t === 'store-order') setOrderProviderId(param)
    if (t === 'category') setCategorySlug(param)
    if (t === 'item-detail') setItemId(param)
    setTab(t); setMoreOpen(false)
    if (t === 'store-detail' && param) window.location.hash = 'store/' + param
  }
  useEffect(() => {
    const m = window.location.hash.match(/^#store\/(.+)$/)
    if (m) { setProviderId(decodeURIComponent(m[1])); setTab('store-detail') }
  }, [])
  const GROCERY_TABS = ['groceries', 'grocery-cart', 'lunches', 'meats', 'grocery-contact', 'stores', 'store-detail', 'store-order', 'category', 'general-products', 'item-detail']
  const inShopping = [...GROCERY_TABS, 'clothes', 'services', 'services-home', 'services-business', 'services-contact', 'about'].includes(tab)
  const inCars = ['cars', 'rent', 'sell', 'testdrive', 'contact'].includes(tab)
  const inFlights = ['flights', 'reserve', 'flight-contact'].includes(tab)

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
        <div className="brand">
          <img className="brand-logo" src={logoUrl} alt="AutoFly.us.com" />
          <span className="tagline">Cars, Flights & More — All in One Place</span>
        </div>
        <div className="header-right">
          <nav>
            <button className={inCars ? 'active' : ''} onClick={() => go('cars')}>Cars</button>
            <button className={inFlights ? 'active' : ''} onClick={() => go('flights')}>Flights</button>
            <span className="dropdown" ref={moreRef}>
              <button className={inShopping ? 'active' : ''} onClick={() => setMoreOpen(o => !o)}>Shopping ▾</button>
              {moreOpen && (
                <span className="dropdown-menu">
                  <a onClick={() => go('stores')}>Groceries</a>
                  <a onClick={() => go('services')}>Services</a>
                  <a onClick={() => go('about')}>About Us</a>
                </span>
              )}
            </span>
          </nav>
          <div className="lang-row" aria-label="Language and region">
            <a className="lang active" href="https://autofly.us.com">US</a>
            <span className="lang soon" title="Coming soon">FR</span>
            <span className="lang soon" title="Coming soon">MA</span>
            <span className="lang soon" title="Coming soon">DE</span>
            <span className="lang soon" title="Coming soon">ES</span>
            <span className="lang soon" title="Coming soon">MX</span>
            <span className="lang soon" title="Coming soon">DO</span>
            <span className="lang soon" title="Coming soon">BE</span>
            <span className="lang soon" title="Coming soon">IT</span>
          </div>
        </div>
        </div>
        <div className="announce-bar">AutoFly officially opens in 2027 — cars, flights, groceries &amp; services, all in one place</div>
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
            {tab === 'stores' && <ProvidersPage go={go} onShop={(id) => go('store-detail', id)} />}
            {tab === 'store-detail' && <ProviderPage providerId={providerId} go={go} />}
            {tab === 'store-order' && <StoreOrderPage providerId={orderProviderId} go={go} />}
            {tab === 'category' && <CategoryPage slug={categorySlug} go={go} />}
            {tab === 'general-products' && (
              <CategoryPage
                slug="store-products" go={go} onlineFilter={false}
                title="Groceries / General Products"
                intro="Store items that are not sold on the Online Store page — browse them here, tap an item for details, or add it to your cart from its store."
              />
            )}
            {tab === 'item-detail' && <ItemDetailPage itemId={itemId} go={go} />}
          </CartProvider>
        )}
        {tab === 'clothes' && <ClothesPage />}
        {tab === 'services' && <ServicesPage go={go} />}
        {tab === 'services-home' && (
          <ServicesSoonPage go={go} title="Home Services" emoji="🏠" topic="Home Services"
            intro="Help around your home is coming to AutoFly — cleaning, repairs, and everyday household services, booked in the same place as everything else."
            items={['Home cleaning & deep cleaning', 'Handyman & small repairs', 'Painting & decorating', 'Gardening & yard work', 'Moving & hauling help', 'Appliance installation & fixes']} />
        )}
        {tab === 'services-business' && (
          <ServicesSoonPage go={go} title="Business Services" emoji="💼" topic="Business Services"
            intro="Services for your business are coming to AutoFly — the practical help that keeps a company running, from paperwork to promotion."
            items={['Bookkeeping & invoicing help', 'Marketing & social media', 'Business websites & online shops', 'Logo & branding design', 'Admin & virtual assistance', 'Translation & documents']} />
        )}
        {tab === 'services-contact' && <ServicesContactPage go={go} />}
        {tab === 'about' && <AboutPage />}
        {tab === 'admin' && <AdminPage />}
      </main>
      <footer className="footer">
        <p>AutoFly.us.com — Cars, Flights & More — All in One Place</p>
        <p className="footer-admin"><a onClick={() => go('admin')}>🔐 Admin</a></p>
      </footer>
      <ChatWidget />
    </div>
  )
}
