import { useState } from 'react'
import CarsMenu from './CarsMenu'
import { submitAndNotify } from '../lib/notify'

export default function SellPage({ go }) {
  const [form, setForm] = useState({ make: '', model: '', year: '', mileage: '', condition: 'Good', vin: '', name: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('Sending your sell request...')
    const subject = `New car sell request: ${form.year} ${form.make} ${form.model} — ${form.name}`
    const full = { ...form, year: Number(form.year), mileage: Number(form.mileage) }
    try {
      try {
        // Includes the message — it's also stored in the DB once the optional
        // message column exists (supabase/add-sell-message.sql). Either way the
        // message always goes out in the email via emailExtras.
        await submitAndNotify({ table: 'car_sell_requests', data: full, subject, emailExtras: { message: form.message } })
      } catch (err) {
        if (!/message/i.test(err.message || '')) throw err
        const { message, ...base } = full
        await submitAndNotify({ table: 'car_sell_requests', data: base, subject, emailExtras: { message: form.message } })
      }
      setStatus('✓ Sent! Your instant offer request was received — we\'ll email you shortly.')
      setForm({ make: '', model: '', year: '', mileage: '', condition: 'Good', vin: '', name: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  return (
    <div>
      <CarsMenu go={go} />
      <div className="hero-card">
        <h2>Sell a Car — get an instant offer</h2>
        <p>Tell us about your car below and we'll email you an instant offer. No obligation — if you like the number, we'll handle the rest: paperwork, pickup, and payment.</p>
      </div>
      <form className="form-card wide" onSubmit={handleSubmit}>
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
        <textarea placeholder="Message — anything else we should know about the car?" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
        <button type="submit">Get instant offer</button>
        {status && <p className="status">{status}</p>}
      </form>
    </div>
  )
}
