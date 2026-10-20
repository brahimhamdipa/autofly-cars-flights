import { useMemo, useState } from 'react'
import CarsMenu from './CarsMenu'
import { loadCars, fmtNum, submitCarInquiry } from './CarSection'

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
        {status && <p className="status">{status}</p>}
      </form>
    </div>
  )
}
