import { useState } from 'react'
import FlightsMenu from './FlightsMenu'
import { submitCarInquiry } from './CarSection'

export default function FlightContactPage({ go }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('Sending your message...')
    try {
      await submitCarInquiry({ carName: 'Contact Us (Flights Department)', name: form.name, email: form.email, phone: form.phone, message: form.message })
      setStatus('✓ Sent! Thanks for reaching out — our Flights Department will get back to you shortly.')
      setForm({ name: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  return (
    <div>
      <FlightsMenu go={go} />
      <div className="hero-card">
        <h2>Contact Us</h2>
        <p>You're contacting our <b>Flights Department</b>. Questions, feedback, or a request about flights — good or bad, we want to hear it. Send us a message below and we'll get back to you.</p>
      </div>
      <form className="form-card wide" onSubmit={handleSubmit}>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <input required placeholder="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        </div>
        <input placeholder="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        <textarea required placeholder="Your message" value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} />
        <button type="submit">Send message</button>
        {status && <p className="status">{status}</p>}
      </form>
    </div>
  )
}
