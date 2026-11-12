import { useState } from 'react'
import FlightsMenu from './FlightsMenu'
import { submitCarInquiry } from './CarSection'

// Pay Flight — the last step of the Flights flow. The customer has
// already agreed a price with us (in chat, by phone or by email) and
// filled in the Flight Reservation form. Here they tell us the exact
// agreed amount, and we send them the secure payment link right away.
// No money is taken on this page: the payment itself happens through
// the link we send, and the confirmation + receipt follow by email
// once it is paid. (Pre-launch behaviour — see the Flights hub.)
export default function FlightPayPage({ go }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', reference: '', amount: '' })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const amount = Number(form.amount)
    if (!amount || amount <= 0) {
      setStatus('Please enter the exact amount we agreed, in dollars.')
      return
    }
    setBusy(true)
    setStatus('Sending...')
    try {
      await submitCarInquiry({
        carName: 'Pay Flight',
        name: form.name,
        email: form.email,
        phone: form.phone,
        message: `Agreed amount: $${amount.toFixed(2)}. Booking reference: ${form.reference.trim() || '—'}. Customer is ready to pay — send the payment link.`,
      })
      setStatus('✓ Thanks! We\'ll send your payment link by chat or email right away. Once it\'s paid, we\'ll email your confirmation, receipt and all the details.')
      setForm({ name: '', email: '', phone: '', reference: '', amount: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <FlightsMenu go={go} />
      <div className="hero-card">
        <h2>Pay Flight</h2>
        <p>You agreed a price with us — pay the exact amount here. No more, no less. Once we've got your payment, we email your confirmation, receipt and all the details.</p>
      </div>
      <form className="form-card wide" onSubmit={handleSubmit}>
        <p style={{ margin: 0 }}>Enter the exact amount we agreed, and we'll send you the secure payment link right away — by chat or email, whichever you were talking to us on.</p>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={e => set('name', e.target.value)} />
          <input required placeholder="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
        </div>
        <input placeholder="Phone (optional)" value={form.phone} onChange={e => set('phone', e.target.value)} />
        <input placeholder="Booking reference (optional — from your reservation)" value={form.reference} onChange={e => set('reference', e.target.value)} />
        <label>Agreed amount (USD)
          <input required type="number" min="1" step="0.01" inputMode="decimal" placeholder="e.g. 450.00" value={form.amount} onChange={e => set('amount', e.target.value)} />
        </label>
        <button type="submit" disabled={busy} style={{ background: '#f5c542', color: '#111827', fontWeight: 700 }}>Send me the payment link →</button>
        {status && <p className="status">{status}</p>}
      </form>
    </div>
  )
}
