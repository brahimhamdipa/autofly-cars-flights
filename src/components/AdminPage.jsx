import { useEffect, useRef, useState } from 'react'

import { supabase } from '../lib/supabaseClient'

import { isAdminUser } from '../lib/admin'

import AdminProducts from './AdminProducts'

import AdminOrders from './AdminOrders'

import AdminSubmissions from './AdminSubmissions'

import AdminStoreAdd from './admin/AdminStoreAdd'

import AdminStoreManage from './admin/AdminStoreManage'

import AdminChat from './admin/AdminChat'

import AdminFolderPasses from './admin/AdminFolderPasses'
import AdminAllPasses from './admin/AdminAllPasses'
import AdminAllOrders from './admin/AdminAllOrders'
import AdminBarcodeGenerator from './admin/AdminBarcodeGenerator'
import AdminCars from './admin/AdminCars'
import AdminDirectUpload from './admin/AdminDirectUpload'
import AdminLiveChat from './admin/AdminLiveChat'

// Five numbered menus, top left. A leaf has a section (an AdminPage
// section) or a table (a Manage table, opened inside the Manage
// section) or the signout action. A branch has children and opens in
// place when tapped — the phone-friendly pattern, no flyouts. Menu 3
// (Flights) is empty for now and will grow later.
// Labels are the admin's own names for the tables, not the database
// table names.
const MENUS = [
  { n: 1, name: 'Shop', items: [
    { label: 'Products & Stock', section: 'products' },
    { label: 'Barcode Generator', section: 'barcode-generator' },
    { label: 'Orders', section: 'orders' },
    { label: 'Form Submissions', section: 'submissions' },
    { label: 'Stores', children: [
      { label: 'Store Passes', table: 'forms' },
      { label: 'Items Approval', table: 'item_batches' },
      { label: 'Items Add.Edit.Del.Approve', table: 'items' },
      { label: 'Store Add.Edit.Del', table: 'providers' },
      { label: 'Delivery Add.Edit.Del', table: 'fromdel' },
      { label: 'Pickup Add.Edit.Del', table: 'topick' },
      { label: 'Category Add.Edit.Del', table: 'itemcats' },
      { label: 'SubCategory Add.Edit.Del', table: 'subcats' },
    ] },
    { label: 'Add', section: 'store-add' },
    { label: 'Sign out', action: 'signout' },
  ] },
  { n: 2, name: 'Cars', items: [
    { label: 'Cars', section: 'cars' },
  ] },
  { n: 3, name: 'Flights', items: [] },
  { n: 4, name: 'Systems', items: [
    { label: 'Diner', children: [
      { label: 'Diner Passes', table: 'diner_restaurants' },
      { label: 'Diner Approvals', table: 'diner_approvals' },
      { label: 'Diner Kitchen', table: 'diner_orders' },
    ] },
    { label: 'POS', children: [
      { label: 'POS Passes', table: 'pos_stores' },
      { label: 'POS Approval', table: 'pos_approvals' },
      { label: 'POS Sales', table: 'pos_sales' },
      { label: 'POS Orders', table: 'pos_orders' },
    ] },
    { label: 'Dealer', children: [
      { label: 'Dealer Passes', table: 'dealer_shops' },
      { label: 'Dealer Approval', table: 'dealer_approvals' },
      { label: 'Dealer Test Drives', table: 'dealer_testdrives' },
      { label: 'Dealer Trade-ins', table: 'dealer_tradeins' },
      { label: 'Dealer Orders', table: 'dealer_orders' },
    ] },
    { label: 'Employee', children: [
      { label: 'Employee Passes', table: 'employee_shops' },
      { label: 'Employee Approval', table: 'employee_approvals' },
      { label: 'Employee Records', table: 'employee_timelogs' },
      { label: 'Employee Orders', table: 'employee_orders' },
    ] },
    { label: 'Bodyshop', children: [
      { label: 'Bodyshop Passes', table: 'bodyshop_shops' },
      { label: 'Bodyshop Approval', table: 'bodyshop_approvals' },
      { label: 'Bodyshop Jobs', table: 'bodyshop_jobs' },
      { label: 'Bodyshop Orders', table: 'bodyshop_orders' },
    ] },
    { label: 'Houses', children: [
      { label: 'Houses Passes', table: 'houses_shops' },
      { label: 'Houses Inquiries', table: 'houses_inquiries' },
      { label: 'Houses Orders', table: 'houses_order' },
    ] },
    { label: 'Doctor', children: [
      { label: 'Doctor Passes', table: 'doctor_shops' },
      { label: 'Doctor Appointments', table: 'doctor_appointments' },
      { label: 'Doctor Orders', table: 'doctor_order' },
    ] },
    { label: 'Holiday', children: [
      { label: 'Holiday Passes', table: 'holiday_shops' },
      { label: 'Holiday Bookings', table: 'holiday_bookings' },
      { label: 'Holiday Orders', table: 'holiday_order' },
    ] },
    { label: 'Car Rental', children: [
      { label: 'Car Rental Passes', table: 'rentals_shops' },
      { label: 'Car Rental Bookings', table: 'rentals_bookings' },
      { label: 'Car Rental Orders', table: 'rentals_order' },
    ] },
    { label: 'Laundry', children: [
      { label: 'Laundry Passes', table: 'laundry_shops' },
      { label: 'Laundry Orders', table: 'laundry_orders' },
      { label: 'Laundry Checkout Orders', table: 'laundry_order' },
    ] },
    { label: 'Yently Kids', children: [
      { label: 'Math', children: [
        { label: 'Kids Math Passes', table: 'kids_math_shops' },
        { label: 'Kids Math Approvals', table: 'kids_math_approvals' },
        { label: 'Kids Math Orders', table: 'kids_math_orders' },
      ] },
      { label: 'English', children: [
        { label: 'Kids English Passes', table: 'kids_english_shops' },
        { label: 'Kids English Approvals', table: 'kids_english_approvals' },
        { label: 'Kids English Orders', table: 'kids_english_orders' },
      ] },
      { label: 'Arabic', children: [
        { label: 'Kids Arabic Passes', table: 'kids_arabic_shops' },
        { label: 'Kids Arabic Approvals', table: 'kids_arabic_approvals' },
        { label: 'Kids Arabic Orders', table: 'kids_arabic_orders' },
      ] },
      { label: 'French', children: [
        { label: 'Kids French Passes', table: 'kids_french_shops' },
        { label: 'Kids French Approvals', table: 'kids_french_approvals' },
        { label: 'Kids French Orders', table: 'kids_french_orders' },
      ] },
      { label: 'Spanish', children: [
        { label: 'Kids Spanish Passes', table: 'kids_spanish_shops' },
        { label: 'Kids Spanish Approvals', table: 'kids_spanish_approvals' },
        { label: 'Kids Spanish Orders', table: 'kids_spanish_orders' },
      ] },
      { label: 'Science', children: [
        { label: 'Kids Science Passes', table: 'kids_science_shops' },
        { label: 'Kids Science Approvals', table: 'kids_science_approvals' },
        { label: 'Kids Science Orders', table: 'kids_science_orders' },
      ] },
      { label: 'Geography', children: [
        { label: 'Kids Geography Passes', table: 'kids_geography_shops' },
        { label: 'Kids Geography Approvals', table: 'kids_geography_approvals' },
        { label: 'Kids Geography Orders', table: 'kids_geography_orders' },
      ] },
      { label: 'Coding', children: [
        { label: 'Kids Coding Passes', table: 'kids_coding_shops' },
        { label: 'Kids Coding Approvals', table: 'kids_coding_approvals' },
        { label: 'Kids Coding Orders', table: 'kids_coding_orders' },
      ] },
      { label: 'Reading', children: [
        { label: 'Kids Reading Passes', table: 'kids_reading_shops' },
        { label: 'Kids Reading Approvals', table: 'kids_reading_approvals' },
        { label: 'Kids Reading Orders', table: 'kids_reading_orders' },
      ] },
    ] },
    { label: 'Add-ons', children: [
      { label: 'TV Gallery Orders', table: 'tv_gallery_orders' },
      { label: 'Live Chat Orders', section: 'live-chat' },
      { label: 'Clean Link Orders', table: 'clean_link_orders' },
      { label: 'Direct Upload Orders', table: 'direct_upload_orders' },
      { label: 'Direct Upload', section: 'direct-upload' },
    ] },
    { label: 'Barbers', children: [
      { label: 'Barber Passes', table: 'barbershop_shops' },
      { label: 'Barber Bookings', table: 'barbershop_bookings' },
      { label: 'Barbershop Orders', table: 'barbershop_orders' },
    ] },
    { label: 'Websites', children: [
      { label: 'Website PrePasses -Domain', table: 'website_domains' },
      { label: 'Website Add.Edit Pass', table: 'intake_forms' },
      { label: 'Website Submission.Approval', table: 'intake_submissions' },
      { label: 'Upload Forms', table: 'upload_forms' },
      { label: 'Website Types', table: 'website_types' },
      { label: 'Header1', table: 'website_headers' },
      { label: 'Header2', table: 'barber_stores' },
      { label: 'Orders', children: [
        { label: 'Body 2.6.titles', table: 'website_bodies' },
        { label: 'Restaurants', table: 'restaurant_orders' },
      ] },
      { label: 'Body3', table: 'barber_styles' },
      { label: 'Body4', table: 'barber_locations' },
      { label: 'Body5', table: 'open_times' },
      { label: 'Customers List', table: 'barber_customers' },
      { label: 'Cust.Subm.DB', table: 'barber_reservations' },
      { label: 'Barbers', table: 'barber_orders' },
      { label: 'Folder Passes', section: 'folder-passes' },
    ] },
  ] },
  { n: 5, name: 'Chat', items: [
    { label: 'All Passes', section: 'all-passes' },
    { label: 'All Orders', section: 'all-orders' },
    { label: 'Live Chat', section: 'chat' },
    { label: 'Chat', children: [
      { label: 'Job Add.Edit.Del', table: 'jobs' },
      { label: 'Employee Add.Edit.Del', table: 'employees' },
      { label: 'Language Add.Edit.Del', table: 'languages' },
      { label: 'Employee Passes', table: 'passes' },
    ] },
  ] },
]

// Admin area: email + password login (Supabase Auth). Only the owner's
// email is authorized — the database enforces the same rule, so this UI
// gate is just the visible half of the protection.
export default function AdminPage() {

  const [session, setSession] = useState(undefined) // undefined = still loading

  const [mode, setMode] = useState('login') // login | signup

  // Not pre-filled: the admin's email address stays off the public page.
  const [email, setEmail] = useState('')

  const [password, setPassword] = useState('')

  const [authMsg, setAuthMsg] = useState('')

  const [section, setSection] = useState('products')

  const [openMenu, setOpenMenu] = useState(null) // null or 1..5

  const [expanded, setExpanded] = useState([]) // branch keys open in the menu

  const [manageTable, setManageTable] = useState('providers')

  const menuRef = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  // Outside tap closes the open menu (same pattern as the website menus).
  useEffect(() => {
    if (openMenu === null) return
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [openMenu])

  const submitAuth = async (e) => {
    e.preventDefault()
    setAuthMsg(mode === 'login' ? 'Logging in...' : 'Creating your account...')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setAuthMsg('')
      } else {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: 'https://yently.com' },
        })
        if (error) throw error
        if (data.session) {
          setAuthMsg('')
        } else {
          setAuthMsg('✓ Account created. Check your email and tap the confirmation link, then come back here and log in.')
          setMode('login')
        }
      }
    } catch (err) {
      setAuthMsg('Error: ' + err.message)
    }
  }

  const signOut = async () => { await supabase.auth.signOut() }

  const closeMenus = () => { setOpenMenu(null); setExpanded([]) }

  const toggleMenu = (n) => { setOpenMenu(openMenu === n ? null : n); setExpanded([]) }

  const toggleBranch = (key) => {
    setExpanded(expanded.includes(key) ? expanded.filter(k => k !== key) : [...expanded, key])
  }

  const goSection = (v) => { setSection(v); closeMenus() }

  const goTable = (t) => { setManageTable(t); setSection('store-manage'); closeMenus() }

  // Recursive menu list: branches open in place, leaves navigate.
  const renderMenuItems = (items, depth, prefix) => items.map((it, i) => {
    const key = prefix + '-' + i
    if (it.children) {
      const open = expanded.includes(key)
      return (
        <div key={key}>
          <button type="button" onClick={() => toggleBranch(key)} style={{ paddingLeft: 8 + depth * 14 }}>
            {open ? '▾' : '▸'} {it.label}
          </button>
          {open && renderMenuItems(it.children, depth + 1, key)}
        </div>
      )
    }
    return (
      <button key={key} type="button" style={{ paddingLeft: 8 + depth * 14 }}
        onClick={() => {
          if (it.action === 'signout') { closeMenus(); signOut(); return }
          if (it.table) goTable(it.table)
          else if (it.section) goSection(it.section)
        }}>
        {it.label}
      </button>
    )
  })

  const sendReset = async () => {
    if (!email.trim()) { setAuthMsg('Type your admin email above first, then tap Forgot password.'); return }
    setAuthMsg('Sending password reset email...')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: 'https://yently.com' })
    if (error) { setAuthMsg('Error: ' + error.message); return }
    setAuthMsg('✓ Reset email sent. Tap the link in that email — you will come back to this site already logged in — then set your new password in Admin → menu 5 → All Passes, at the bottom of the page.')
  }

  if (session === undefined) {
    return <div className="hero-card"><p>Loading admin...</p></div>
  }

  if (!session) {
    return (
      <div>
        <div className="hero-card">
          <h2>🔐 Yently Admin</h2>
          <p>This area is private. Log in with your admin email and password to manage products, stock, pictures, orders and reports.</p>
        </div>
        <form className="form-card wide" onSubmit={submitAuth}>
          <div className="trip-tabs">
            <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => { setMode('login'); setAuthMsg('') }}>Log in</button>
            <button type="button" className={mode === 'signup' ? 'active' : ''} onClick={() => { setMode('signup'); setAuthMsg('') }}>Create account</button>
          </div>
          <input required type="email" placeholder="Admin email" value={email} onChange={e => setEmail(e.target.value)} />
          <input required type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit">{mode === 'login' ? 'Log in' : 'Create my admin account'}</button>
          {authMsg && <p className="status">{authMsg}</p>}
          <p className="hint">
            {mode === 'login'
              ? <>First time here? Tap <b>Create account</b> above, choose a password, and confirm from the email we send you — then log in here.<br /><button type="button" className="link-btn" onClick={sendReset}>Forgot your password?</button></>
              : <>Use your own email and a password you choose. Never share the password in chat — not even with me.</>}
          </p>
        </form>
      </div>
    )
  }

  if (!isAdminUser(session.user)) {
    return (
      <div className="hero-card">
        <h2>Not authorized</h2>
        <p>You're logged in as <b>{session.user.email}</b>, which is not the admin account for this website. No admin data is available to this account.</p>
        <button onClick={signOut}>Sign out</button>
      </div>
    )
  }

  return (
    <div>
      <div className="admin-nav no-print">
        <div className="car-submenu-wrap" ref={menuRef}>
          <div style={{ display: 'flex', gap: 10 }}>
            {MENUS.map(m => (
              <div key={m.n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <button className="car-submenu-btn" onClick={() => toggleMenu(m.n)} aria-haspopup="true" aria-expanded={openMenu === m.n} aria-label={'Menu ' + m.n + ' — ' + m.name}>
                  <span style={{ fontWeight: 800 }}>{m.n}</span>
                </button>
                <span style={{ fontSize: 11 }}>{m.name}</span>
              </div>
            ))}
          </div>
          {openMenu !== null && (
            <div className="car-submenu">
              <p style={{ margin: '10px 0 2px', fontWeight: 'bold' }}>Menu {openMenu} — {MENUS[openMenu - 1].name}</p>
              {MENUS[openMenu - 1].items.length === 0
                ? <p className="hint">Nothing here yet — more to come.</p>
                : renderMenuItems(MENUS[openMenu - 1].items, 0, 'm' + openMenu)}
            </div>
          )}
        </div>
      </div>
      {section === 'products' && <AdminProducts />}
      {section === 'cars' && <AdminCars />}
      {section === 'direct-upload' && <AdminDirectUpload />}
      {section === 'live-chat' && <AdminLiveChat />}
      {section === 'orders' && <AdminOrders />}
      {section === 'submissions' && <AdminSubmissions />}
      {section === 'store-add' && <AdminStoreAdd />}
      {section === 'store-manage' && <AdminStoreManage table={manageTable} onTableChange={setManageTable} />}
      {section === 'chat' && <AdminChat />}
      {section === 'all-passes' && <AdminAllPasses />}
      {section === 'all-orders' && <AdminAllOrders />}
      {section === 'barcode-generator' && <AdminBarcodeGenerator />}
      {section === 'folder-passes' && <AdminFolderPasses />}
      <button type="button" className="admin-to-top no-print" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>↑ Top</button>
    </div>
  )
}
