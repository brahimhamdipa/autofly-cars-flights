import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'

export default function FlightSection() {
  const [tripType, setTripType] = useState('Round Trip')
  const [form, setForm] = useState({
    from_city: '', to_city: '', depart_date: '', return_date: '',
    adults: 1, children: 0, cabin_class: 'Economy', direct_only: false,
    name: '', email: '', phone: '',
  })
  const [childAges, setChildAges] = useState([])
  const [status, setStatus] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const setChildren = (v) => {
    const n = Math.max(0, Math.min(8, Number(v) || 0))
    set('children', n)
    setChildAges(prev => {
      const next = [...prev]
      next.length = n
      return next.map(a => (a === undefined ? '' : a))
    })
  }

  const setAge = (i, v) => setChildAges(prev => prev.map((a, idx) => (idx === i ? v : a)))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('Searching & reserving...')
    const adults = Number(form.adults) || 1
    const children = Number(form.children) || 0
    const ages = childAges.map(a => Number(a))
    const breakdown = {
      adults,
      children,
      children_ages: children > 0 ? ages.join(', ') : null,
    }
    const baseData = {
      trip_type: tripType,
      from_city: form.from_city,
      to_city: form.to_city,
      depart_date: form.depart_date,
      return_date: tripType === 'Round Trip' ? form.return_date : null,
      travelers: adults + children,
      cabin_class: form.cabin_class,
      direct_only: form.direct_only,
      name: form.name, email: form.email, phone: form.phone,
    }
    try {
      try {
        // Preferred: store the adults/children breakdown in the DB too.
        await submitAndNotify({
          table: 'flight_bookings',
          data: { ...baseData, ...breakdown },
          subject: `New flight reservation: ${form.from_city} → ${form.to_city}`,
        })
      } catch (err) {
        // If the adults/children columns don't exist yet, save the booking
        // the original way and still email the full breakdown.
        if (!/adults|children/i.test(err.message || '')) throw err
        await submitAndNotify({
          table: 'flight_bookings',
          data: baseData,
          emailExtras: breakdown,
          subject: `New flight reservation: ${form.from_city} → ${form.to_city}`,
        })
      }
      setStatus('✓ Reservation request sent! Our travel expert will email you within 24h.')
      setForm({ from_city: '', to_city: '', depart_date: '', return_date: '', adults: 1, children: 0, cabin_class: 'Economy', direct_only: false, name: '', email: '', phone: '' })
      setChildAges([])
    } catch (err) {
      setStatus('Error: ' + err.message + ' (check Supabase .env)')
    }
  }

  return (
    <div>
      <div className="hero-card">
        <h2>Cheap flights, fast & secure booking</h2>
        <p>Like CheapFareGuru — compare multi-airline fares, direct flights, last-minute deals. Fill the simple form and we handle the rest.</p>
        <div className="trip-tabs">
          {['One Way', 'Round Trip', 'Multi City'].map(t => (
            <button key={t} type="button" className={tripType === t ? 'active' : ''} onClick={() => setTripType(t)}>{t}</button>
          ))}
        </div>
      </div>

      <form className="form-card wide" onSubmit={handleSubmit}>
        <div className="row">
          <label>From<input required placeholder="City or airport (e.g. NYC)" value={form.from_city} onChange={e => set('from_city', e.target.value)} /></label>
          <label>To<input required placeholder="City or airport (e.g. LAX)" value={form.to_city} onChange={e => set('to_city', e.target.value)} /></label>
        </div>
        <div className="row">
          <label>Depart<input required type="date" value={form.depart_date} onChange={e => set('depart_date', e.target.value)} /></label>
          {tripType === 'Round Trip' && (
            <label>Return<input type="date" value={form.return_date} onChange={e => set('return_date', e.target.value)} /></label>
          )}
          <label>Adults<input type="number" min="1" max="9" value={form.adults} onChange={e => set('adults', e.target.value)} /></label>
          <label>Children<input type="number" min="0" max="8" value={form.children} onChange={e => setChildren(e.target.value)} /></label>
        </div>
        {Number(form.children) > 0 && (
          <div className="row">
            {Array.from({ length: Number(form.children) }, (_, i) => (
              <label key={i}>Age of child {i + 1}
                <input required type="number" min="0" max="17" placeholder="Years" value={childAges[i] ?? ''} onChange={e => setAge(i, e.target.value)} />
              </label>
            ))}
          </div>
        )}
        <div className="row">
          <label>Cabin
            <select value={form.cabin_class} onChange={e => set('cabin_class', e.target.value)}>
              <option>Economy</option><option>Premium Economy</option><option>Business</option><option>First</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={form.direct_only} onChange={e => set('direct_only', e.target.checked)} /> Direct flights only</label>
        </div>
        {tripType === 'Multi City' && <p className="hint">Multi-city: add your extra legs in the notes after submitting — our expert will call you.</p>}
        <div className="row">
          <input required placeholder="Full name" value={form.name} onChange={e => set('name', e.target.value)} />
          <input required placeholder="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          <input placeholder="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
        </div>
        <button type="submit">Request reservation</button>
        <p className="hint">Prefer to book over call? Our U.S.-based experts are available 24x7x365. Every request is emailed to our team instantly.</p>
      </form>
      {status && <p className="status">{status}</p>}
    </div>
  )
}
