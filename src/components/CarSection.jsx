import { useEffect, useMemo, useState } from 'react'
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

export default function CarSection() {
  const cars = useMemo(loadCars, [])
  const [filterText, setFilterText] = useState('')
  const [maxPrice, setMaxPrice] = useState('')
  const [interestCar, setInterestCar] = useState(null)
  const [sellForm, setSellForm] = useState({ make: '', model: '', year: '', mileage: '', condition: 'Good', vin: '', name: '', email: '', phone: '' })
  const [buyForm, setBuyForm] = useState({ car_name: '', name: '', email: '', phone: '', message: '' })
  const [sellStatus, setSellStatus] = useState('')
  const [buyStatus, setBuyStatus] = useState('')

  const filtered = cars.filter(c => {
    if (filterText && !c.name.toLowerCase().includes(filterText.toLowerCase())) return false
    if (maxPrice && priceNum(c.price) > Number(maxPrice)) return false
    return true
  })

  const handleSell = async (e) => {
    e.preventDefault()
    setSellStatus('Sending your sell request...')
    try {
      await submitAndNotify({
        table: 'car_sell_requests',
        data: { ...sellForm, year: Number(sellForm.year), mileage: Number(sellForm.mileage) },
        subject: `New car sell request: ${sellForm.year} ${sellForm.make} ${sellForm.model} — ${sellForm.name}`,
      })
      setSellStatus('✓ Sent! Your instant offer request was received — we\'ll email you shortly.')
      setSellForm({ make: '', model: '', year: '', mileage: '', condition: 'Good', vin: '', name: '', email: '', phone: '' })
    } catch (err) {
      setSellStatus('Error: ' + err.message)
    }
  }

  const handleBuy = async (e) => {
    e.preventDefault()
    setBuyStatus('Sending your inquiry...')
    try {
      await submitCarInquiry({ carName: buyForm.car_name, name: buyForm.name, email: buyForm.email, phone: buyForm.phone, message: buyForm.message })
      setBuyStatus('✓ Sent! Your inquiry was received — the seller will contact you.')
      setBuyForm({ car_name: '', name: '', email: '', phone: '', message: '' })
    } catch (err) {
      setBuyStatus('Error: ' + err.message)
    }
  }

  return (
    <div>
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

      <div className="two-col">
        <form className="form-card" onSubmit={handleSell}>
          <h3>Sell your car — get an instant offer</h3>
          <div className="row">
            <input required placeholder="Make (e.g. Honda)" value={sellForm.make} onChange={e => setSellForm({ ...sellForm, make: e.target.value })} />
            <input required placeholder="Model (e.g. Accord)" value={sellForm.model} onChange={e => setSellForm({ ...sellForm, model: e.target.value })} />
          </div>
          <div className="row">
            <input required placeholder="Year" type="number" value={sellForm.year} onChange={e => setSellForm({ ...sellForm, year: e.target.value })} />
            <input required placeholder="Mileage" type="number" value={sellForm.mileage} onChange={e => setSellForm({ ...sellForm, mileage: e.target.value })} />
          </div>
          <div className="row">
            <select value={sellForm.condition} onChange={e => setSellForm({ ...sellForm, condition: e.target.value })}>
              <option>Excellent</option><option>Good</option><option>Fair</option><option>Poor</option>
            </select>
            <input placeholder="VIN (optional)" value={sellForm.vin} onChange={e => setSellForm({ ...sellForm, vin: e.target.value })} />
          </div>
          <div className="row">
            <input required placeholder="Your name" value={sellForm.name} onChange={e => setSellForm({ ...sellForm, name: e.target.value })} />
            <input required placeholder="Email" type="email" value={sellForm.email} onChange={e => setSellForm({ ...sellForm, email: e.target.value })} />
          </div>
          <input placeholder="Phone" value={sellForm.phone} onChange={e => setSellForm({ ...sellForm, phone: e.target.value })} />
          <button type="submit">Get instant offer</button>
          {sellStatus && <p className="status">{sellStatus}</p>}
        </form>

        <form className="form-card" onSubmit={handleBuy}>
          <h3>Request a car / test drive</h3>
          <select required value={buyForm.car_name} onChange={e => setBuyForm({ ...buyForm, car_name: e.target.value })}>
            <option value="">Select a car</option>
            {cars.map(c => <option key={c.name} value={c.name}>{c.name}{c.price ? ` — $${fmtNum(c.price)}` : ''}</option>)}
          </select>
          <div className="row">
            <input required placeholder="Your name" value={buyForm.name} onChange={e => setBuyForm({ ...buyForm, name: e.target.value })} />
            <input required placeholder="Email" type="email" value={buyForm.email} onChange={e => setBuyForm({ ...buyForm, email: e.target.value })} />
          </div>
          <input placeholder="Phone" value={buyForm.phone} onChange={e => setBuyForm({ ...buyForm, phone: e.target.value })} />
          <textarea placeholder="Message" value={buyForm.message} onChange={e => setBuyForm({ ...buyForm, message: e.target.value })} />
          <button type="submit">Send inquiry</button>
          {buyStatus && <p className="status">{buyStatus}</p>}
        </form>
      </div>
    </div>
  )
}
