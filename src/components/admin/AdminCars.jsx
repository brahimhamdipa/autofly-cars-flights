import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fetchAll, fmtDate } from '../../lib/admin'
import { fmtNum } from '../CarSection'

// Admin → menu 2 (Cars): the two halves of the database-driven Cars system.
//
// LISTINGS — every car row, newest first. Pending rows (sent by a seller
// through the seller form) get an Approve button, which makes the car show
// on the public Cars page; Delete removes a row forever. Approved rows can
// also be deleted here.
// SELLERS — the people allowed to list cars. Each seller has a username
// and password handed out by the admin, stored READABLE here BY DESIGN
// (throwaway only, like the store provider passes). A seller's cars stay
// linked to them; deleting a seller leaves their cars listed (seller
// becomes blank) — delete the cars first if they should go too.
//
// The public Cars page reads approved rows only, and sellers write only
// through the password-checked RPCs, so nothing here is reachable by a
// visitor.

function SellerName({ sellerId, sellers }) {
  const s = sellers.find(x => x.id === sellerId)
  return <>{s ? s.name : 'Yently'}</>
}

export default function AdminCars() {
  const [view, setView] = useState('listings')
  const [listings, setListings] = useState(null)
  const [sellers, setSellers] = useState(null)
  const [filter, setFilter] = useState('pending')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [sellerForm, setSellerForm] = useState({ name: '', slug: '', username: '', password: '', email: '', phone: '' })

  const load = async () => {
    try {
      const [l, s] = await Promise.all([fetchAll('car_listings'), fetchAll('car_sellers')])
      setListings(l)
      setSellers(s)
    } catch (e) { setError(e.message); setListings([]); setSellers([]) }
  }
  useEffect(() => { load() }, [])

  const approve = async (row) => {
    setStatus('Approving...')
    const { error: err } = await supabase.rpc('approve_car_listing', { p_id: row.id })
    if (err) { setStatus(''); setError(err.message); return }
    setStatus(`✓ Approved — ${row.name} now shows on the Cars page.`)
    load()
  }

  const deleteListing = async (row) => {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return
    const { error: err } = await supabase.from('car_listings').delete().eq('id', row.id)
    if (err) { setError(err.message); return }
    setStatus(`Deleted ${row.name}.`)
    load()
  }

  const addSeller = async (e) => {
    e.preventDefault()
    setStatus('Saving seller...')
    const { error: err } = await supabase.from('car_sellers').insert({
      name: sellerForm.name.trim(),
      slug: sellerForm.slug.trim().toLowerCase(),
      username: sellerForm.username.trim(),
      password: sellerForm.password,
      email: sellerForm.email.trim() || null,
      phone: sellerForm.phone.trim() || null,
    })
    if (err) { setStatus(''); setError(err.message); return }
    setStatus(`✓ Seller ${sellerForm.name} saved — give them the username and password.`)
    setSellerForm({ name: '', slug: '', username: '', password: '', email: '', phone: '' })
    load()
  }

  const deleteSeller = async (row) => {
    if (!window.confirm(`Delete seller "${row.name}"? Their cars stay listed (seller becomes blank). This cannot be undone.`)) return
    const { error: err } = await supabase.from('car_sellers').delete().eq('id', row.id)
    if (err) { setError(err.message); return }
    setStatus(`Deleted seller ${row.name}.`)
    load()
  }

  const shown = (listings || []).filter(r => filter === 'all' ? true : r.status === filter)
  const pendingCount = (listings || []).filter(r => r.status === 'pending').length

  return (
    <div>
      <div className="hero-card">
        <h2>🚗 Cars</h2>
        <p>Cars are listed from the database. Sellers send their cars through the seller form (username + password you give them) — they arrive here as Pending, and nothing shows on the public page until you approve it.</p>
      </div>

      <div className="trip-tabs" style={{ marginBottom: 16 }}>
        <button type="button" className={view === 'listings' ? 'active' : ''} onClick={() => setView('listings')}>Listings {pendingCount > 0 && `(${pendingCount} pending)`}</button>
        <button type="button" className={view === 'sellers' ? 'active' : ''} onClick={() => setView('sellers')}>Sellers</button>
      </div>

      {status && <p className="status">{status}</p>}
      {error && <p className="status">Error: {error}</p>}

      {view === 'listings' && (
        <div>
          <div className="trip-tabs" style={{ marginBottom: 12 }}>
            <button type="button" className={filter === 'pending' ? 'active' : ''} onClick={() => setFilter('pending')}>Pending</button>
            <button type="button" className={filter === 'approved' ? 'active' : ''} onClick={() => setFilter('approved')}>Approved</button>
            <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All</button>
          </div>
          {listings === null && <div className="hero-card"><p>Loading listings...</p></div>}
          {listings !== null && shown.length === 0 && <p className="hint">Nothing here yet.</p>}
          {shown.length > 0 && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Car</th><th>Price</th><th>Mileage</th><th>Seller</th><th>Photos</th><th>Status</th><th>Added</th><th className="no-print"></th></tr>
                </thead>
                <tbody>
                  {shown.map(r => (
                    <tr key={r.id}>
                      <td title={r.description || ''}>{r.name}{r.year || r.make ? ` — ${[r.year, r.make, r.model].filter(Boolean).join(' ')}` : ''}</td>
                      <td>{r.price ? `$${fmtNum(r.price)}` : ''}</td>
                      <td>{r.mileage ? fmtNum(r.mileage) : ''}</td>
                      <td><SellerName sellerId={r.seller_id} sellers={sellers || []} /></td>
                      <td>{Array.isArray(r.photos) ? r.photos.length : 0}</td>
                      <td>{r.status}</td>
                      <td>{fmtDate(r.created_at)}</td>
                      <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                        {r.status === 'pending' && (
                          <button type="button" className="btn-mini" onClick={() => approve(r)}>Approve</button>
                        )}{' '}
                        <button type="button" className="btn-mini btn-danger" onClick={() => deleteListing(r)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'sellers' && (
        <div>
          <form className="form-card wide" onSubmit={addSeller}>
            <h3>Add a seller</h3>
            <p className="hint">Give the seller this username and password — they use them on the seller form to add cars. Keep them throwaway-style, one per seller.</p>
            <div className="row">
              <input required placeholder="Seller name (e.g. Demo Cars)" value={sellerForm.name} onChange={e => setSellerForm({ ...sellerForm, name: e.target.value })} />
              <input required placeholder="Slug (e.g. demo-cars)" value={sellerForm.slug} onChange={e => setSellerForm({ ...sellerForm, slug: e.target.value })} />
            </div>
            <div className="row">
              <input required placeholder="Username" value={sellerForm.username} onChange={e => setSellerForm({ ...sellerForm, username: e.target.value })} />
              <input required placeholder="Password" value={sellerForm.password} onChange={e => setSellerForm({ ...sellerForm, password: e.target.value })} />
            </div>
            <div className="row">
              <input placeholder="Email (optional)" type="email" value={sellerForm.email} onChange={e => setSellerForm({ ...sellerForm, email: e.target.value })} />
              <input placeholder="Phone (optional)" type="tel" value={sellerForm.phone} onChange={e => setSellerForm({ ...sellerForm, phone: e.target.value })} />
            </div>
            <button type="submit">Save seller</button>
          </form>

          {sellers === null && <div className="hero-card"><p>Loading sellers...</p></div>}
          {sellers !== null && sellers.length === 0 && <p className="hint">No sellers yet.</p>}
          {sellers !== null && sellers.length > 0 && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Seller</th><th>Slug</th><th>Username</th><th>Password</th><th>Email</th><th>Phone</th><th className="no-print"></th></tr>
                </thead>
                <tbody>
                  {sellers.map(s => (
                    <tr key={s.id}>
                      <td>{s.name}</td>
                      <td>{s.slug}</td>
                      <td>{s.username}</td>
                      <td>{s.password}</td>
                      <td>{s.email || ''}</td>
                      <td>{s.phone || ''}</td>
                      <td className="no-print">
                        <button type="button" className="btn-mini btn-danger" onClick={() => deleteSeller(s)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
