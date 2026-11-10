import { useEffect, useRef, useState } from 'react'
import CarSection from './components/CarSection'
import FlightSection from './components/FlightSection'
import AboutPage from './components/AboutPage'
import SellPage from './components/SellPage'
import CarSellerFormPage from './components/CarSellerFormPage'
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
import { BusinessCartProvider } from './lib/BusinessCartContext'
import BarbersPage from './components/BarbersPage'
import SimpleBarbershopPage from './components/SimpleBarbershopPage'
import RestaurantsPage from './components/RestaurantsPage'
import PosPage from './components/PosPage'
import DealerPage from './components/DealerPage'
import EmployeePage from './components/EmployeePage'
import BodyshopPage from './components/BodyshopPage'
import TvGalleryPage from './components/TvGalleryPage'
import LiveChatPage from './components/LiveChatPage'
import CleanLinkPage from './components/CleanLinkPage'
import LiveChatDemo from './components/LiveChatDemo'
import BusinessCartPage from './components/BusinessCartPage'
import BusinessSystemsPage from './components/BusinessSystemsPage'
import KidsHubPage from './components/KidsHubPage'
import KidsMathPage from './components/KidsMathPage'
import KidsEnglishPage from './components/KidsEnglishPage'
import KidsArabicPage from './components/KidsArabicPage'
import KidsFrenchPage from './components/KidsFrenchPage'
import KidsSpanishPage from './components/KidsSpanishPage'
import KidsSciencePage from './components/KidsSciencePage'
import KidsGeographyPage from './components/KidsGeographyPage'
import KidsCodingPage from './components/KidsCodingPage'
import KidsReadingPage from './components/KidsReadingPage'
import BooksForKidsPage from './components/BooksForKidsPage'
import logoUrl from './assets/logo.webp'
import './index.css'

export default function App() {
  // The admin page has no visible link anywhere: it opens only by
  // typing yently.com/admin (see vercel.json rewrite). A provider
  // form opens the same way, at yently.com/<form name>.
  const [tab, setTab] = useState(() => {
    const path = window.location.pathname.replace(/\/$/, '')
    if (path === '/admin') return 'admin'
    if (path === '/demo-live-chat' || path === '/demo-chat') return 'demo-live-chat'
    if (path !== '' && path !== '/') return 'provider-form'
    return 'business-hub'
  })
  const [formSlug, setFormSlug] = useState(() => {
    const path = window.location.pathname.replace(/\/$/, '')
    if (path !== '' && path !== '/' && path !== '/admin' && path !== '/demo-live-chat' && path !== '/demo-chat') return decodeURIComponent(path.slice(1))
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
    // entering the live-chat demo shows /demo-live-chat, and leaving
    // any of them returns to /.
    const path = window.location.pathname.replace(/\/$/, '')
    const onAdmin = path === '/admin'
    const onDemo = path === '/demo-live-chat' || path === '/demo-chat'
    const onForm = path !== '' && path !== '/' && !onAdmin && !onDemo
    if (t === 'admin' && !onAdmin) window.history.replaceState(null, '', '/admin')
    else if (t === 'demo-live-chat' && !onDemo) window.history.replaceState(null, '', '/demo-live-chat')
    else if (t === 'provider-form' && param && !onForm) window.history.replaceState(null, '', '/' + param)
    else if (t !== 'admin' && t !== 'provider-form' && t !== 'demo-live-chat' && (onAdmin || onForm || onDemo)) window.history.replaceState(null, '', '/')
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
  const BUSINESS_TABS = ['business-hub', 'restaurants', 'pos', 'barbers', 'dealer', 'employee', 'bodyshop', 'simple-barbershop', 'tv-gallery', 'live-chat', 'clean-link', 'demo-live-chat', 'business-cart']
  const KIDS_TABS = ['kids-hub', 'kids-math', 'kids-english', 'kids-arabic', 'kids-french', 'kids-spanish', 'kids-science', 'kids-geography', 'kids-coding', 'kids-reading', 'kids-books']
  const inMore = ['services', 'services-home', 'services-contact', 'about', 'clothes'].includes(tab) || KIDS_TABS.includes(tab)
  const inBusiness = BUSINESS_TABS.includes(tab)
  const inCars = ['cars', 'sell', 'contact', 'car-seller'].includes(tab)
  const inFlights = ['flights', 'reserve', 'flight-contact'].includes(tab)

  return (
    <div className="app">
      <header className="header">
        <div className="header-row">
        <div className="brand">
          <img className="brand-logo" src={logoUrl} alt="Yently" />
          <span className="tagline">Business Systems, Shop, Cars &amp; Flights — All in One Place</span>
        </div>
        <div className="header-right">
          <nav>
            <button className={inBusiness ? 'active' : ''} onClick={() => go('business-hub')}>Systems</button>
            <button className={GROCERY_TABS.includes(tab) ? 'active' : ''} onClick={() => go('products')}>Shop</button>
            <button className={inCars ? 'active' : ''} onClick={() => go('cars')}>Cars</button>
            <button className={inFlights ? 'active' : ''} onClick={() => go('flights')}>Flights</button>
            <span className="dropdown" ref={moreRef}>
              <button className={inMore ? 'active' : ''} onClick={() => setMoreOpen(o => !o)}>More ▾</button>
              {moreOpen && (
                <span className="dropdown-menu">
                  <a onClick={() => go('kids-hub')}>Yently Kids</a>
                  <a onClick={() => go('services')}>Services</a>
                  <a onClick={() => go('about')}>About Us</a>
                </span>
              )}
            </span>
          </nav>
          <div className="lang-row" aria-label="Language">
            <a className="lang active" href="https://yently.com">En</a>
            <span className="lang soon" title="Coming soon">Fr</span>
            <span className="lang soon" title="Coming soon">Ar</span>
            <span className="lang soon" title="Coming soon">Es</span>
            <span className="lang soon" title="Coming soon">De</span>
            <span className="lang soon" title="Coming soon">It</span>
            <span className="lang soon" title="Coming soon">Pt</span>
            <span className="lang soon" title="Coming soon">Nl</span>
          </div>
        </div>
        </div>
        <div className="announce-bar">Yently officially opens in 2027 — business systems, cars, flights, groceries &amp; services, all in one place</div>
      </header>
      <main className="main">
        {tab === 'cars' && <CarSection go={go} />}
        {tab === 'sell' && <SellPage go={go} />}
        {tab === 'car-seller' && <CarSellerFormPage go={go} />}
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
        {BUSINESS_TABS.includes(tab) && (
          <BusinessCartProvider>
            {tab === 'business-hub' && <BusinessSystemsPage go={go} />}
            {tab === 'restaurants' && <RestaurantsPage go={go} />}
            {tab === 'pos' && <PosPage go={go} />}
            {tab === 'barbers' && <BarbersPage go={go} />}
            {tab === 'dealer' && <DealerPage go={go} />}
            {tab === 'employee' && <EmployeePage go={go} />}
            {tab === 'bodyshop' && <BodyshopPage go={go} />}
            {tab === 'simple-barbershop' && <SimpleBarbershopPage go={go} />}
            {tab === 'tv-gallery' && <TvGalleryPage go={go} />}
            {tab === 'live-chat' && <LiveChatPage go={go} />}
            {tab === 'clean-link' && <CleanLinkPage go={go} />}
            {tab === 'demo-live-chat' && <LiveChatDemo go={go} />}
            {tab === 'business-cart' && <BusinessCartPage go={go} />}
          </BusinessCartProvider>
        )}
        {KIDS_TABS.includes(tab) && (
          <BusinessCartProvider>
            {tab === 'kids-hub' && <KidsHubPage go={go} />}
            {tab === 'kids-math' && <KidsMathPage go={go} />}
            {tab === 'kids-english' && <KidsEnglishPage go={go} />}
            {tab === 'kids-arabic' && <KidsArabicPage go={go} />}
            {tab === 'kids-french' && <KidsFrenchPage go={go} />}
            {tab === 'kids-spanish' && <KidsSpanishPage go={go} />}
            {tab === 'kids-science' && <KidsSciencePage go={go} />}
            {tab === 'kids-geography' && <KidsGeographyPage go={go} />}
            {tab === 'kids-coding' && <KidsCodingPage go={go} />}
            {tab === 'kids-reading' && <KidsReadingPage go={go} />}
            {tab === 'kids-books' && <BooksForKidsPage go={go} />}
          </BusinessCartProvider>
        )}
        {tab === 'clothes' && <ClothesPage />}
        {tab === 'services' && <ServicesPage go={go} />}
        {tab === 'services-home' && (
          <ServicesSoonPage go={go} title="Home Services" emoji="🏠" topic="Home Services"
            intro="Help around your home is coming to Yently — cleaning, repairs, and everyday household services, booked in the same place as everything else."
            items={['Home cleaning & deep cleaning', 'Handyman & small repairs', 'Painting & decorating', 'Gardening & yard work', 'Moving & hauling help', 'Appliance installation & fixes']} />
        )}
        {tab === 'services-contact' && <ServicesContactPage go={go} />}
        {tab === 'about' && <AboutPage />}
        {tab === 'admin' && <AdminPage />}
        {tab === 'provider-form' && <ProviderFormPage slug={formSlug} goBack={goBack} onAuthedChange={setFormAuthed} go={go} />}
      </main>
      <footer className="footer">
        <p>Yently — Business Systems, Shop, Cars &amp; Flights — All in One Place</p>
      </footer>
      {!(tab === 'provider-form' && formAuthed) && tab !== 'demo-live-chat' && <ChatWidget />}
    </div>
  )
}
