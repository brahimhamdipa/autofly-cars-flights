import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ADMIN_EMAIL, isAdminUser } from '../lib/admin'
import AdminDashboard from './AdminDashboard'
import AdminProducts from './AdminProducts'
import AdminOrders from './AdminOrders'
import AdminSubmissions from './AdminSubmissions'

const SECTIONS = [
  ['dashboard', '📊 Dashboard & Reports'],
  ['products', '🛒 Products & Stock'],
  ['orders', '🧾 Orders'],
  ['submissions', '✉️ Form Submissions (Cars / Flights / Contact / Notify)'],
]

// Admin area: email + password login (Supabase Auth). Only the owner's
// email is authorized — the database enforces the same rule, so this UI
// gate is just the visible half of the protection.
export default function AdminPage() {
  const [session, setSession] = useState(undefined) // undefined = still loading
  const [mode, setMode] = useState('login') // login | signup
  const [email, setEmail] = useState(ADMIN_EMAIL)
  const [password, setPassword] = useState('')
  const [authMsg, setAuthMsg] = useState('')
  const [section, setSection] = useState('dashboard')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const submitAuth = async (e) => {
    e.preventDefault()
    setAuthMsg(mode === 'login' ? 'Logging in...' : 'Creating your account...')
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        setAuthMsg('')
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password })
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

  if (session === undefined) {
    return <div className="hero-card"><p>Loading admin...</p></div>
  }

  if (!session) {
    return (
      <div>
        <div className="hero-card">
          <h2>🔐 AutoFly Admin</h2>
          <p>This area is private. Log in with your admin email and password to manage products, stock, pictures, orders and reports.</p>
        </div>
        <form className="form-card wide" onSubmit={submitAuth}>
          <input required type="email" placeholder="Admin email" value={email} onChange={e => setEmail(e.target.value)} />
          <input required type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit">{mode === 'login' ? 'Log in' : 'Create my admin account'}</button>
          {authMsg && <p className="status">{authMsg}</p>}
          <p className="hint">
            {mode === 'login'
              ? <>First time here? <a onClick={() => { setMode('signup'); setAuthMsg('') }}>Create your admin account</a> — use your own email and a password you choose. Never share it in chat.</>
              : <>Already created it? <a onClick={() => { setMode('login'); setAuthMsg('') }}>Back to log in</a></>}
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
      <div className="admin-head no-print">
        <div className="admin-pick">
          <label htmlFor="admin-section"><b>Admin — choose what to manage:</b></label>
          <select id="admin-section" className="admin-select" value={section} onChange={e => setSection(e.target.value)}>
            {SECTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="admin-actions">
          <button type="button" onClick={() => window.print()}>🖨 Print / Save PDF</button>
          <button type="button" className="btn-soft" onClick={signOut}>Sign out</button>
        </div>
      </div>
      <p className="hint no-print">Printing makes a clean report of whatever section you're viewing — on iPhone: Print → pinch out / share → Save to Files as PDF.</p>
      {section === 'dashboard' && <AdminDashboard />}
      {section === 'products' && <AdminProducts />}
      {section === 'orders' && <AdminOrders />}
      {section === 'submissions' && <AdminSubmissions />}
    </div>
  )
}
