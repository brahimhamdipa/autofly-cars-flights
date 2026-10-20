import { useEffect, useMemo, useRef, useState } from 'react'
import { submitAndNotify } from '../lib/notify'

// ---------------------------------------------------------------------------
// Folder-driven inventory.
// To add a car for sale: create Cars/<Car Name>/ containing photos plus a
// car.txt file, then push to GitHub. car.txt format (one per line):
//   mileage: 45200
//   description: One-owner, clean title, new tires.
//   price: 18900
// The site rebuilds on push (auto-deploy) and the car appears automatically.
// ---------------------------------------------------------------------------
const txtModules = import.meta.glob('../../Cars/*/car.txt', { query: '?raw', import: 'default', eager: true })
const imgModules = import.meta.glob('../../Cars/*/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', { query: '?url', import: 'default', eager: true })

function parseCarTxt(raw) {
  const info = { mileage: '', description: '', price: '' }
  for (const line of String(raw || '').split('\n')) {
    const i = line.indexOf(':')
    if (i === -1) continue
    const key = line.slice(0, i).trim().toLowerCase()
    const val = line.slice(i + 1).trim()
    if (['mileage', 'miles', 'mi'].includes(key)) info.mileage = val
    else if (['description', 'desc', 'details'].includes(key)) info.description = val
    else if (['price', 'cost'].includes(key)) info.price = val
  }
  return info
}

function loadCars() {
  const cars = []
  for (const [path, raw] of Object.entries(txtModules)) {
    const m = path.match(/Cars\/([^/]+)\/car\.txt$/)
    if (!m) continue
    const name = m[1]
    const prefix = `../../Cars/${name}/`
    const images = Object.entries(imgModules)
      .filter(([p]) => p.startsWith(prefix))
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([, url]) => url)
    cars.push({ name, ...parseCarTxt(raw), images })
  }
  return cars.sort((a, b) => a.name.localeCompare(b.name))
}

const fmtNum = (v) => {
  const s = String(v ?? '').trim()
  if (!s) return ''
  const n = Number(s.replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) ? n.toLocaleString() : s
}
const priceNum = (v) => Number(String(v ?? '').replace(/[^0-9.]/g, '')) || 0

// Insert an inquiry; falls back to legacy columns if the car_name
// migration hasn't been run yet in Supabase.
async function submitCarInquiry({ carName, name, email, phone, message }) {
  const subject = `New inquiry: ${carName} — ${name}`
  try {
    return await submitAndNotify({
      table: 'car_inquiries',
      data: { car_id: null, car_name: carName, name, email, phone, message },
      subject,
    })
  } catch (err) {
    if (/car_name/i.test(err.message || '')) {
      return await submitAndNotify({
        table: 'car_inquiries',
        data: { car_id: 0, name, email, phone, message: `[${carName}] ${message}` },
        subject,
      })
    }
    throw err
  }
}

function Lightbox({ images, start, onClose }) {
  const [idx, setIdx] = useState(start)
  const n = images.length
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft') setIdx(i => (i - 1 + n) % n)
      if (e.key === 'ArrowRight') setIdx(i => (i + 1) % n)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [n, onClose])
  if (!n) return null
  return (
    <div className="lightbox" onClick={onClose}>
      <button className="lightbox-close" onClick={onClose} aria-label="Close">✕</button>
      {n > 1 && <button className="slide-btn prev" onClick={e => { e.stopPropagation(); setIdx(i => (i - 1 + n) % n) }} aria-label="Previous">‹</button>}
      <img src={images[idx]} alt="" onClick={e => e.stopPropagation()} />
      {n > 1 && <button className="slide-btn next" onClick={e => { e.stopPropagation(); setIdx(i => (i + 1) % n) }} aria-label="Next">›</button>}
      <span className="slide-count">{idx + 1} / {n}</span>
    </div>
  )
}

function CarCard({ car, onInterested }) {
  const [idx, setIdx] = useState(0)
  const [zoom, setZoom] = useState(false)
  const n = car.images.length
  return (
    <div className="card">
      <div className="slideshow">
        {n > 0 ? (
          <img src={car.images[idx]} alt={car.name} onClick={() => setZoom(true)} title="Click to enlarge" />
        ) : (
          <div className="no-photo">No photos yet</div>
        )}
        {n > 1 && (
          <>
            <button className="slide-btn prev" onClick={() => setIdx(i => (i - 1 + n) % n)} aria-label="Previous photo">‹</button>
            <button className="slide-btn next" onClick={() => setIdx(i => (i + 1) % n)} aria-label="Next photo">›</button>
            <span className="slide-count">{idx + 1} / {n}</span>
          </>
        )}
      </div>
      <div className="card-body">
        <h3>{car.name}</h3>
        {car.mileage && <p>{fmtNum(car.mileage)} miles</p>}
        {car.description && <p className="car-desc">{car.description}</p>}
        {car.price && <p className="price">${fmtNum(car.price)}</p>}
        <button onClick={() => onInterested(car)}>I'm interested</button>
      </div>
      {zoom && n > 0 && <Lightbox images={car.images} start={idx} onClose={() => setZoom(false)} />}
    </div>
  )
}

function InterestModal({ car, onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: `I'm interested in the ${car.name}.` })
  const [status, setStatus] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('Sending...')
    try {
      await submitCarInquiry({ carName: car.name, ...form })
      setSent(true)
      setStatus('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        {sent ? (
          <div className="confirm">
            <h3>✓ Sent!</h3>
            <p>Thanks {form.name.split(' ')[0] || 'there'} — your interest in the <b>{car.name}</b> was sent. We'll be in touch shortly.</p>
            <button onClick={onClose}>Close</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="modal-form">
            <h3>I'm interested — {car.name}</h3>
            <input required placeholder="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            <input required placeholder="Tel" type="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <textarea required placeholder="Write us a message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
            <button type="submit">Submit</button>
            {status && <p className="hint">{status}</p>}
          </form>
        )}
      </div>
    </div>
  )
}

function SellModal({ onClose }) {
  const [form, setForm] = useState({ make: '', model: '', year: '', mileage: '', condition: 'Good', vin: '', name: '', email: '', phone: '' })
  const [status, setStatus] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('Sending your sell request...')
    try {
      await submitAndNotify({
        table: 'car_sell_requests',
        data: { ...form, year: Number(form.year), mileage: Number(form.mileage) },
        subject: `New car sell request: ${form.year} ${form.make} ${form.model} — ${form.name}`,
      })
      setSent(true)
      setStatus('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        {sent ? (
          <div className="confirm">
            <h3>✓ Sent!</h3>
            <p>Your instant offer request was received — we'll email you shortly.</p>
            <button onClick={onClose}>Close</button>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            <h3>Sell your car — get an instant offer</h3>
            <div className="row">
              <input required placeholder="Make (e.g. Honda)" value={form.make} onChange={e => setForm({ ...form, make: e.target.value })} />
              <input required placeholder="Model (e.g. Accord)" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
            </div>
            <div className="row">
              <input required placeholder="Year" type="number" value={form.year} onChange={e => setForm({ ...form, year: e.target.value })} />
              <input required placeholder="Mileage" type="number" value={form.mileage} onChange={e => setForm({ ...form, mileage: e.target.value })} />
            </div>
            <div className="row">
              <select value={form.condition} onChange={e => setForm({ ...form, condition: e.target.value })}>
                <option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option>
              </select>
              <input placeholder="VIN (optional)" value={form.vin} onChange={e => setForm({ ...form, vin: e.target.value })} />
            </div>
            <div className="row">
              <input required placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <button type="submit">Get instant offer</button>
            {status && <p className="hint">{status}</p>}
          </form>
        )}
      </div>
    </div>
  )
}

function ContactModal({ onClose }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('Sending your message...')
    try {
      await submitCarInquiry({ carName: 'Contact Us', name: form.name, email: form.email, phone: form.phone, message: form.message })
      setSent(true)
      setStatus('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        {sent ? (
          <div className="confirm">
            <h3>✓ Sent!</h3>
            <p>Thanks for reaching out — we'll get back to you shortly.</p>
            <button onClick={onClose}>Close</button>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            <h3>Contact Us</h3>
            <p className="hint">Questions, feedback, or a request — good or bad, we want to hear it. Send us a message and we'll get back to you.</p>
            <div className="row">
              <input required placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <textarea required placeholder="Your message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
            <button type="submit">Send message</button>
            {status && <p className="hint">{status}</p>}
          </form>
        )}
      </div>
    </div>
  )
}

function RequestModal({ cars, onClose }) {
  const [form, setForm] = useState({ car_name: '', name: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState('')
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('Sending your inquiry...')
    try {
      await submitCarInquiry({ carName: form.car_name, name: form.name, email: form.email, phone: form.phone, message: form.message })
      setSent(true)
      setStatus('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        {sent ? (
          <div className="confirm">
            <h3>✓ Sent!</h3>
            <p>Your inquiry was received — the seller will contact you.</p>
            <button onClick={onClose}>Close</button>
          </div>
        ) : (
          <form className="modal-form" onSubmit={handleSubmit}>
            <h3>Info / Test drive a Car</h3>
            <select required value={form.car_name} onChange={e => setForm({ ...form, car_name: e.target.value })}>
              <option value="">Select a car</option>
              {cars.map(c => <option key={c.name} value={c.name}>{c.name}{c.price ? ` — $${fmtNum(c.price)}` : ''}</option>)}
            </select>
            <div className="row">
              <input required placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <textarea placeholder="Message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
            <button type="submit">Send inquiry</button>
            {status && <p className="hint">{status}</p>}
          </form>
        )}
      </div>
    </div>
  )
}

export default function CarSection({ onRent }) {
  const cars = useMemo(loadCars, [])
  const [filterText, setFilterText] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [interestCar, setInterestCar] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showSell, setShowSell] = useState(false)
  const [showRequest, setShowRequest] = useState(false)
  const [showContact, setShowContact] = useState(false)
  const menuRef = useRef(null)

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const filtered = cars.filter(c => {
    if (filterText && !c.name.toLowerCase().includes(filterText.toLowerCase())) return false
    if (maxPrice && priceNum(c.price) > Number(maxPrice)) return false
    return true
  })

  return (
    <div>
      <div className="car-submenu-wrap" ref={menuRef}>
        <button className="car-submenu-btn" onClick={() => setMenuOpen(o => !o)} aria-haspopup="true" aria-expanded={menuOpen} aria-label="Cars menu">
          <span className="burger" aria-hidden="true"><span /><span /><span /></span>
        </button>
        {menuOpen && (
          <div className="car-submenu">
            <button onClick={() => { setMenuOpen(false); onRent && onRent() }}>Rent a Car</button>
            <button onClick={() => { setMenuOpen(false); setShowSell(true) }}>Sell a Car</button>
            <button onClick={() => { setMenuOpen(false); setShowRequest(true) }}>Info/Test drive a Car</button>
            <button onClick={() => { setMenuOpen(false); setShowContact(true) }}>Contact Us</button>
          </div>
        )}
      </div>

      <div className="hero-card">
        <h2>Buy your next car, fully online</h2>
        <p>Browse our cars below — every listing shows real photos, mileage, and price. Or sell us your car with an instant offer.</p>
        <div className="filters">
          <input placeholder="Search cars (e.g. Camry)" value={filterText} onChange={e => setFilterText(e.target.value)} />
          <input placeholder="Max price ($)" type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="hero-card"><p>No cars match. To add cars, create a folder under <b>Cars</b> named after the car, add its photos and a <b>car.txt</b> file, then push.</p></div>
      )}

      <div className="grid">
        {filtered.map(car => (
          <CarCard key={car.name} car={car} onInterested={setInterestCar} />
        ))}
      </div>

      {interestCar && <InterestModal car={interestCar} onClose={() => setInterestCar(null)} />}
      {showSell && <SellModal onClose={() => setShowSell(false)} />}
      {showRequest && <RequestModal cars={cars} onClose={() => setShowRequest(false)} />}
      {showContact && <ContactModal onClose={() => setShowContact(false)} />}
    </div>
  )
}
