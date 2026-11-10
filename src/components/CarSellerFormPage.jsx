import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { shrinkImage } from '../lib/storeUpload'
import { fmtNum } from './CarSection'
import CarsMenu from './CarsMenu'

// ---------------------------------------------------------------------------
// Seller form for Cars (2026-11-09 database rebuild).
// A seller logs in with the username + password the admin gave them
// (stored readable in the DB by design, throwaway only — same rule as the
// store provider passes). Then they see their own cars, add one, edit one,
// or upload many at once from a data.json file. Everything they send lands
// as 'pending' and only shows on the public Cars page after the admin
// approves it in Admin → menu 2 → Cars. Editing a car sends it back to
// pending for re-approval.
// Pictures go to the same product-images bucket the shop uses, under
// cars/<seller-slug>/, shrunk in the browser first (max 1600px).
// ---------------------------------------------------------------------------

const EMPTY_CAR = { year: '', make: '', model: '', name: '', mileage: '', price: '', description: '', phone: '', email: '' }

async function uploadCarPictures(files, slug) {
  const urls = []
  for (const file of files) {
    const up = await shrinkImage(file)
    const safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `cars/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
    const { error } = await supabase.storage.from('product-images').upload(path, up)
    if (error) throw error
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}

const SAMPLE_JSON = [
  {
    year: 2019, make: 'Ford', model: 'Focus', name: '2019 Ford Focus',
    mileage: 61200, price: 7500,
    description: 'One-owner hatchback, clean title, new brakes.',
    phone: '', email: '', photos: [],
  },
]

function CarForm({ seller, creds, initial, onDone, onCancel }) {
  const [form, setForm] = useState(initial || EMPTY_CAR)
  const [photos, setPhotos] = useState(initial && initial.photos ? initial.photos : [])
  const [newFiles, setNewFiles] = useState([])
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const fillName = () => {
    const name = [form.year, form.make, form.model].filter(Boolean).join(' ')
    if (name) setForm(f => ({ ...f, name }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setStatus('Sending...')
    try {
      const uploaded = newFiles.length > 0 ? await uploadCarPictures(newFiles, seller.slug) : []
      const allPhotos = [...photos, ...uploaded]
      const args = {
        p_username: creds.username,
        p_password: creds.password,
        p_year: form.year === '' ? null : Number(form.year),
        p_make: form.make.trim() || null,
        p_model: form.model.trim() || null,
        p_name: form.name.trim(),
        p_mileage: form.mileage === '' ? null : Number(form.mileage),
        p_price: form.price === '' ? null : Number(form.price),
        p_description: form.description.trim() || null,
        p_phone: form.phone.trim() || null,
        p_email: form.email.trim() || null,
        p_photos: allPhotos,
      }
      if (initial && initial.id) {
        await supabase.rpc('update_car_listing', { ...args, p_id: initial.id })
        setStatus('✓ Saved — your car is back to pending, Yently will approve it again before it shows.')
      } else {
        await supabase.rpc('submit_car_listing', args)
        setStatus('✓ Sent for approval — your car will show on the Cars page once Yently approves it.')
      }
      onDone()
    } catch (err) {
      setStatus('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="form-card wide" onSubmit={handleSubmit}>
      <h3>{initial && initial.id ? `Edit — ${initial.name}` : 'Add a car'}</h3>
      <div className="row">
        <input placeholder="Year (e.g. 2021)" type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
        <input placeholder="Make (e.g. Toyota)" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} />
        <input placeholder="Model (e.g. Camry)" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
      </div>
      <div className="row">
        <input required placeholder="Car name (e.g. 2021 Toyota Camry)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ flex: 2 }} />
        <button type="button" onClick={fillName}>Use year + make + model</button>
      </div>
      <div className="row">
        <input placeholder="Mileage" type="number" value={form.mileage} onChange={e => setForm({ ...form, mileage: e.target.value })} />
        <input placeholder="Price ($)" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
      </div>
      <textarea placeholder="Description — condition, features, anything a buyer should know" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={3} />
      <div className="row">
        <input placeholder="Your phone (shown to buyers)" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <input placeholder="Your email (shown to buyers)" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
      </div>
      <div>
        <span className="field-label">Pictures</span>
        <input type="file" accept="image/*" multiple onChange={e => setNewFiles(Array.from(e.target.files || []))} />
        {(photos.length > 0 || newFiles.length > 0) && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {photos.map((url, i) => (
              <span key={url} style={{ position: 'relative' }}>
                <img src={url} alt="" style={{ width: 72, height: 54, objectFit: 'cover', borderRadius: 8 }} />
                <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, padding: 0, borderRadius: '50%', fontSize: 11 }}>✕</button>
              </span>
            ))}
            {newFiles.map((f, i) => (
              <span key={f.name + i} className="hint" style={{ width: 72, height: 54, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #d1d5db', borderRadius: 8, fontSize: 11, textAlign: 'center', overflow: 'hidden' }}>{f.name}</span>
            ))}
          </div>
        )}
      </div>
      <div className="row">
        <button type="submit" disabled={saving}>{initial && initial.id ? 'Save changes' : 'Send for approval'}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
      {status && <p className="status">{status}</p>}
    </form>
  )
}

export default function CarSellerFormPage({ go }) {
  const [creds, setCreds] = useState({ username: '', password: '' })
  const [seller, setSeller] = useState(null)
  const [loginMsg, setLoginMsg] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [cars, setCars] = useState(null)
  const [carsMsg, setCarsMsg] = useState('')
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [batch, setBatch] = useState([])
  const [batchMsg, setBatchMsg] = useState('')
  const [uploadingBatch, setUploadingBatch] = useState(false)

  // The username is never saved on the device: no restore, and any
  // name an older version saved is cleared the first time this page
  // opens, so the field always starts empty.
  useEffect(() => {
    try { localStorage.removeItem('yently-car-seller-username') } catch {}
  }, [])

  const loadCars = async (c) => {
    try {
      const { data, error } = await supabase.rpc('list_my_cars', { p_username: c.username, p_password: c.password })
      if (error) throw error
      setCars(data || [])
    } catch (err) {
      setCarsMsg('Error: ' + err.message)
      setCars([])
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoggingIn(true)
    setLoginMsg('Checking...')
    try {
      const { data, error } = await supabase.rpc('check_car_seller', { p_username: creds.username.trim(), p_password: creds.password })
      if (error) throw error
      if (!data || data.length === 0) {
        setLoginMsg('Wrong username or password for this form.')
        return
      }
      const s = data[0]
      const c = { username: creds.username.trim(), password: creds.password }
      setSeller(s)
      setLoginMsg('')
      loadCars(c)
    } catch (err) {
      setLoginMsg('Error: ' + err.message)
    } finally {
      setLoggingIn(false)
    }
  }

  const signOut = () => {
    setSeller(null)
    setCreds({ username: '', password: '' })
    setCars(null)
    setEditing(null)
    setShowAdd(false)
    setBatch([])
  }

  const deleteCar = async (car) => {
    if (confirmDelete !== car.id) { setConfirmDelete(car.id); return }
    setConfirmDelete(null)
    const { error } = await supabase.rpc('delete_car_listing', { p_username: creds.username, p_password: creds.password, p_id: car.id })
    if (error) { setCarsMsg('Error: ' + error.message); return }
    setCarsMsg(`Deleted ${car.name}.`)
    loadCars(creds)
  }

  const loadBatchFile = async (file) => {
    setBatchMsg('')
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed)) { setBatchMsg('That file is not a list — a list file holds a list of cars in [square brackets].'); return }
      const bad = parsed.filter(c => !c || typeof c !== 'object' || !String(c.name || '').trim())
      if (bad.length > 0) { setBatchMsg(`${bad.length} row(s) have no car name — every car needs a name.`); return }
      setBatch(parsed)
      setBatchMsg(`${parsed.length} car(s) loaded from the file — tap "Upload for approval" to send them.`)
    } catch {
      setBatchMsg('Could not read that file — it must be a list file with a list of cars.')
    }
  }

  const uploadBatch = async () => {
    setUploadingBatch(true)
    setBatchMsg('Sending...')
    try {
      const { data, error } = await supabase.rpc('submit_car_listings_batch', {
        p_username: creds.username,
        p_password: creds.password,
        p_cars: batch,
      })
      if (error) throw error
      setBatchMsg(`✓ ${data?.inserted ?? batch.length} car(s) sent for approval — they will show on the Cars page once Yently approves them.`)
      setBatch([])
      loadCars(creds)
    } catch (err) {
      setBatchMsg('Error: ' + err.message)
    } finally {
      setUploadingBatch(false)
    }
  }

  const downloadSample = () => {
    const blob = new Blob([JSON.stringify(SAMPLE_JSON, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-cars.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!seller) {
    return (
      <div>
        <CarsMenu go={go} />
        <div className="hero-card">
          <h2>Sell your cars on Yently</h2>
          <p>Log in with the username and password Yently gave you, then add your cars — one at a time, or many at once from a list file. Every car is checked by Yently before it shows on the Cars page.</p>
        </div>
        <form className="form-card wide" onSubmit={handleLogin} autoComplete="off">
          <input required placeholder="Username" autoComplete="off" value={creds.username} onChange={e => setCreds({ ...creds, username: e.target.value })} />
          <input required placeholder="Password" type="password" autoComplete="current-password" value={creds.password} onChange={e => setCreds({ ...creds, password: e.target.value })} />
          <button type="submit" disabled={loggingIn}>{loggingIn ? 'Checking...' : 'Log in'}</button>
          {loginMsg && <p className="status">{loginMsg}</p>}
          <p className="hint">Don't have a username yet? Ask Yently for one — the admin creates it in Admin → menu 2 → Cars → Sellers.</p>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="button" onClick={() => go('car-seller-soon')} style={{ background: '#f5c542', color: '#161d44', fontWeight: 700 }}>Become a Yently Car Seller</button>
            <p className="hint">Seller logins open soon — tap to see what's coming.</p>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div>
      <CarsMenu go={go} />
      <div className="hero-card">
        <h2>Your cars — {seller.name}</h2>
        <p>Your listings are below. "Pending" means Yently is still checking it; "Approved" means buyers can see it on the Cars page. Editing a car sends it back for approval.</p>
        <button type="button" onClick={signOut}>Sign out</button>
      </div>

      {carsMsg && <p className="status">{carsMsg}</p>}
      {cars === null && <div className="hero-card"><p>Loading your cars...</p></div>}
      {cars !== null && cars.length === 0 && <p className="hint">No cars yet — add your first one below.</p>}
      {cars !== null && cars.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Car</th><th>Price</th><th>Status</th><th className="no-print"></th></tr>
            </thead>
            <tbody>
              {cars.map(car => (
                <tr key={car.id}>
                  <td>{car.name}</td>
                  <td>{car.price ? `$${fmtNum(car.price)}` : ''}</td>
                  <td>{car.status}</td>
                  <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn-mini" onClick={() => { setEditing(car); setShowAdd(false) }}>Edit</button>{' '}
                    <button
                      type="button"
                      className="btn-mini btn-danger"
                      onClick={() => deleteCar(car)}
                    >
                      {confirmDelete === car.id ? 'Tap again to confirm' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <CarForm
          seller={seller}
          creds={creds}
          initial={{ id: editing.id, year: editing.year || '', make: editing.make || '', model: editing.model || '', name: editing.name, mileage: editing.mileage || '', price: editing.price || '', description: editing.description || '', phone: editing.phone || '', email: editing.email || '', photos: editing.photos || [] }}
          onDone={() => { setEditing(null); loadCars(creds) }}
          onCancel={() => setEditing(null)}
        />
      ) : showAdd ? (
        <CarForm seller={seller} creds={creds} onDone={() => { setShowAdd(false); loadCars(creds) }} onCancel={() => setShowAdd(false)} />
      ) : (
        <button onClick={() => setShowAdd(true)} style={{ marginBottom: 16 }}>+ Add a car</button>
      )}

      <div className="form-card wide">
        <h3>Add many cars at once (from a list file)</h3>
        <p className="hint">Make a list of cars in a list file — one entry per car, with year, make, model, name, mileage, price, description, phone, email, and photos (a list of picture links). Load the file here, check the list, then upload it for approval.</p>
        <div className="row">
          <button type="button" onClick={downloadSample}>Download an example list file</button>
          <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Load a list file
            <input type="file" accept=".json,application/json" onChange={e => { const f = e.target.files && e.target.files[0]; if (f) loadBatchFile(f); e.target.value = '' }} />
          </label>
        </div>
        {batch.length > 0 && (
          <div>
            <ul>
              {batch.map((c, i) => (
                <li key={i}>{c.name}{c.price ? ` — $${fmtNum(c.price)}` : ''}</li>
              ))}
            </ul>
            <button type="button" onClick={uploadBatch} disabled={uploadingBatch}>{uploadingBatch ? 'Sending...' : `Upload ${batch.length} car(s) for approval`}</button>
          </div>
        )}
        {batchMsg && <p className="status">{batchMsg}</p>}
      </div>
    </div>
  )
}
