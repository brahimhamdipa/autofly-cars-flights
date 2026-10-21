import { useMemo, useState } from 'react'
import CarsMenu from './CarsMenu'
import { loadCars, fmtNum, submitCarInquiry } from './CarSection'

// Type-to-filter car picker (same behavior as the Flights airport boxes):
// as you type, cars that don't match disappear from the list.
function CarPicker({ cars, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)

  const results = useMemo(() => {
    const q = (value || '').trim().toLowerCase()
    if (!q) return cars.slice(0, 10)
    const starts = cars.filter(c => c.name.toLowerCase().startsWith(q))
    const contains = cars.filter(c => !c.name.toLowerCase().startsWith(q) && c.name.toLowerCase().includes(q))
    return [...starts, ...contains].slice(0, 10)
  }, [cars, value])

  const pick = (car) => {
    onChange(car.name)
    setOpen(false)
    setHighlight(-1)
  }

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pick(results[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="airport-wrap">
      <input
        required
        placeholder="Start typing a car name…"
        value={value}
        autoComplete="off"
        onChange={e => { onChange(e.target.value); setOpen(true); setHighlight(-1) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
      />
      {open && results.length > 0 && (
        <ul className="airport-list">
          {results.map((c, i) => (
            <li
              key={c.name}
              className={i === highlight ? 'active' : ''}
              onMouseDown={e => { e.preventDefault(); pick(c) }}
            >
              <span className="airport-main">{c.name}</span>
              <span className="airport-sub">
                {[c.mileage ? `${fmtNum(c.mileage)} miles` : '', c.price ? `$${fmtNum(c.price)}` : ''].filter(Boolean).join(' — ')}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function TestDrivePage({ go }) {
  const cars = useMemo(loadCars, [])
  const [form, setForm] = useState({ car_name: '', name: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('Sending your inquiry...')
    try {
      await submitCarInquiry({ carName: form.car_name, name: form.name, email: form.email, phone: form.phone, message: form.message })
      setStatus('✓ Sent! Your inquiry was received — the seller will contact you.')
      setForm({ car_name: '', name: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  return (
    <div>
      <CarsMenu go={go} />
      <div className="hero-card">
        <h2>Info / Test drive a Car</h2>
        <p>Pick a car below, ask us anything about it, or book a test drive at a time that suits you — send the form and we'll get back to you shortly.</p>
      </div>
      <form className="form-card wide" onSubmit={handleSubmit}>
        <CarPicker cars={cars} value={form.car_name} onChange={v => setForm({ ...form, car_name: v })} />
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <textarea placeholder="Message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
        <button type="submit">Send inquiry</button>
        {status && <p className="status">{status}</p>}
      </form>
    </div>
  )
}
