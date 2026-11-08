import { useEffect, useRef, useState } from 'react'
import CarSection from './components/CarSection'
import FlightSection from './components/FlightSection'
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
import ProductsPage from './components/ProductsPage'
import CategoryPage from './components/CategoryPage'
import ItemDetailPage from './components/ItemDetailPage'
import ProviderFormPage from './components/ProviderFormPage'
import ChatWidget from './components/ChatWidget'
import AdminPage from './components/AdminPage'
import { CartProvider } from './lib/CartContext'
import { BarberCartProvider } from './lib/BarberCartContext'
import BarbersPage from './components/BarbersPage'
import SimpleBarbershopPage from './components/SimpleBarbershopPage'
import RestaurantsPage from './components/RestaurantsPage'
import RestaurantsCartPage from './components/RestaurantsCartPage'
import PosPage from './components/PosPage'
import { RestaurantCartProvider } from './lib/RestaurantCartContext'
import PosCartPage from './components/PosCartPage'
import { PosCartProvider } from './lib/PosCartContext'
import DealerPage from './components/DealerPage'
import DealerCartPage from './components/DealerCartPage'
import { DealerCartProvider } from './lib/DealerCartContext'
import EmployeePage from './components/EmployeePage'
import EmployeeCartPage from './components/EmployeeCartPage'
import { EmployeeCartProvider } from './lib/EmployeeCartContext'
import BodyshopPage from './components/BodyshopPage'
import BodyshopCartPage from './components/BodyshopCartPage'
import { BodyshopCartProvider } from './lib/BodyshopCartContext'
import BarberCartPage from './components/BarberCartPage'
import logoUrl from './assets/logo.webp'
import './index.css'

export default function App() {
  // The admin page has no visible link anywhere: it opens only by
  // typing autofly.us.com/admin (see vercel.json rewrite). A provider
  // form opens the same way, at autofly.us.com/<form name>.
  const [tab, setTab] = useState(() => {
    const path = window.location.pathname.replace(/\/$/, '')
    if (path === '/admin') return 'admin'
    if (path !== '' && path !== '/') return 'provider-form'
    return 'products'
  })
  const [formSlug, setFormSlug] = useState(() => {
    const path = window.location.pathname.replace(/\/$/, '')
    if (path !== '' && path !== '/' && path !== '/admin') return decodeURIComponent(path.slice(1))
    return null
  })
  const [providerId, setProviderId] = useState(null)
  const [orderProviderId, setOrderProviderId] = useState(null)
  const [categorySlug, setCategorySlug] = useState(null)
  const [itemId, setItemId] = useState(null)
  // Previous page snapshot, so detail pages can offer a real "← Back"
  // to wherever the customer came from (not always the store).
  const [prev, setPrev] = useState(null)
  const [moreOpen, setMoreOpen] = useState(false)
  const [formAuthed, setFormAuthed] = useState(false)
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
    setPrev({ tab, providerId, orderProviderId, categorySlug, itemId, formSlug })
    if (t === 'store-detail') setProviderId(param)
    if (t === 'store-order') setOrderProviderId(param)
    if (t === 'category') setCategorySlug(param)
    if (t === 'item-detail') setItemId(param)
    if (t === 'provider-form') setFormSlug(param)
    setTab(t); setMoreOpen(false)
    if (t === 'store-detail' && param) window.location.hash = 'store/' + param
    // Keep the address bar honest for the hidden routes: entering
    // admin shows /admin, entering a provider form shows /<name>,
    // leaving either returns to /.
    const path = window.location.pathname.replace(/\/$/, '')
    const onAdmin = path === '/admin'
    const onForm = path !== '' && path !== '/' && !onAdmin
    if (t === 'admin' && !onAdmin) window.history.replaceState(null, '', '/admin')
    else if (t === 'provider-form' && param && !onForm) window.history.replaceState(null, '', '/' + param)
    else if (t !== 'admin' && t !== 'provider-form' && (onAdmin || onForm)) window.history.replaceState(null, '', '/')
  }
  // Back to the page the customer actually came from (or nowhere on a
  // fresh load, in which case pages hide their back link).
  const goBack = prev ? () => {
    setTab(prev.tab); setProviderId(prev.providerId); setOrderProviderId(prev.orderProviderId)
    setCategorySlug(prev.categorySlug); setItemId(prev.itemId); setFormSlug(prev.formSlug); setMoreOpen(false)
    if (prev.tab === 'store-detail' && prev.providerId) window.location.hash = 'store/' + prev.providerId
    else if (window.location.hash) window.location.hash = ''
  } : null

  useEffect(() => {
    const m = window.location.hash.match(/^#store\/(.+)$/)
    if (m) { setProviderId(decodeURIComponent(m[1])); setTab('store-detail') }
  }, [])

  const GROCERY_TABS = ['grocery-cart', 'lunches', 'meats', 'grocery-contact', 'stores', 'store-detail', 'store-order', 'category', 'products', 'item-detail']
  const BARBER_TABS = ['barbers', 'barber-cart', 'simple-barbershop']
  const RESTAURANT_TABS = ['restaurants', 'restaurant-cart', 'pos', 'pos-cart', 'dealer', 'dealer-cart', 'employee', 'employee-cart', 'bodyshop', 'bodyshop-cart']
  const inMore = ['services', 'services-home', 'services-business', 'services-contact', 'about', 'clothes', 'restaurants', 'restaurant-cart', 'pos', 'pos-cart', 'dealer', 'dealer-cart', 'employee', 'employee-cart', 'bodyshop', 'bodyshop-cart', 'barbers', 'barber-cart', 'simple-barbershop'].includes(tab)
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
            <button className={GROCERY_TABS.includes(tab) ? 'active' : ''} onClick={() => go('products')}>Shopping</button>
            <button className={inCars ? 'active' : ''} onClick={() => go('cars')}>Cars</button>
            <button className={inFlights ? 'active' : ''} onClick={() => go('flights')}>Flights</button>
            <span className="dropdown" ref={moreRef}>
              <button className={inMore ? 'active' : ''} onClick={() => setMoreOpen(o => !o)}>More ▾</button>
              {moreOpen && (
                <span className="dropdown-menu">
                  <a onClick={() => go('restaurants')}>Business Systems</a>
                  <a onClick={() => go('barbers')}>Sample Websites</a>
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
            {tab === 'stores' && <ProvidersPage go={go} onShop={(id) => go('store-order', id)} onView={(id) => go('store-detail', id)} />}
            {tab === 'store-detail' && <ProviderPage providerId={providerId} go={go} goBack={goBack} />}
            {tab === 'store-order' && <StoreOrderPage providerId={orderProviderId} go={go} goBack={goBack} />}
            {tab === 'products' && <ProductsPage go={go} />}
            {tab === 'category' && <CategoryPage slug={categorySlug} go={go} />}
            {tab === 'item-detail' && <ItemDetailPage itemId={itemId} go={go} goBack={goBack} />}
          </CartProvider>
        )}
        {RESTAURANT_TABS.includes(tab) && (
          <RestaurantCartProvider>
          <PosCartProvider>
          <DealerCartProvider>
          <EmployeeCartProvider>
          <BodyshopCartProvider>
            {tab === 'restaurants' && <RestaurantsPage go={go} />}
            {tab === 'restaurant-cart' && <RestaurantsCartPage go={go} />}
            {tab === 'pos' && <PosPage go={go} />}
            {tab === 'pos-cart' && <PosCartPage go={go} />}
            {tab === 'dealer' && <DealerPage go={go} />}
            {tab === 'dealer-cart' && <DealerCartPage go={go} />}
            {tab === 'employee' && <EmployeePage go={go} />}
            {tab === 'employee-cart' && <EmployeeCartPage go={go} />}
            {tab === 'bodyshop' && <BodyshopPage go={go} />}
            {tab === 'bodyshop-cart' && <BodyshopCartPage go={go} />}
          </BodyshopCartProvider>
          </EmployeeCartProvider>
          </DealerCartProvider>
          </PosCartProvider>
          </RestaurantCartProvider>
        )}
        {BARBER_TABS.includes(tab) && (
          <BarberCartProvider>
            {tab === 'barbers' && <BarbersPage go={go} />}
            {tab === 'barber-cart' && <BarberCartPage go={go} />}
            {tab === 'simple-barbershop' && <SimpleBarbershopPage go={go} />}
          </BarberCartProvider>
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
        {tab === 'provider-form' && <ProviderFormPage slug={formSlug} goBack={goBack} onAuthedChange={setFormAuthed} />}
      </main>
      <footer className="footer">
        <p>AutoFly.us.com — Cars, Flights & More — All in One Place</p>
      </footer>
      {!(tab === 'provider-form' && formAuthed) && <ChatWidget />}
    </div>
  )
}
