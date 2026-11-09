import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { KidsTopBar } from './KidsMenu'

// Books for Kids — coming soon. Real children's books delivered to
// the door, starting in the US first. No price yet, no cart — just a
// notify-me form (Name + Email) so interested parents can hear when
// it launches. Every signup lands in car_inquiries as
// "Books for Kids — Notify Me" and emails the owner, exactly like
// the other request forms. Nothing here promises a date.
export default function BooksForKidsPage({ go }) {
  const [form, setForm] = useState({ name: '', email: '' })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setStatus('Signing you up...')
    try {
      await submitAndNotify({
        table: 'car_inquiries',
        data: { car_id: null, car_name: 'Books for Kids — Notify Me', name: form.name, email: form.email, phone: '', message: '' },
        subject: `Books for Kids — Notify Me — ${form.name}`,
      })
      setStatus('✓ You\'re on the list! We\'ll email you as soon as Books for Kids launches.')
      setForm({ name: '', email: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <KidsTopBar go={go} />
      <div className="hero-card">
        <span className="tag">Coming Soon</span>
        <h2>📚 Books for Kids</h2>
        <p>Real books for children, delivered to your door — starting in the US first.</p>
        <div className="sample-note">
          <b>What's coming:</b>
          <ul>
            <li>Picture books for the youngest readers</li>
            <li>Early readers for children learning to read on their own</li>
            <li>Story books for bedtime and the classroom</li>
            <li>Books in English and Arabic to start, more languages to follow</li>
          </ul>
        </div>
        <p className="hint">Delivery starts in the US first. Leave your name and email below and we'll tell you as soon as it launches near you.</p>
      </div>

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>🔔 Tell me when Books for Kids launches</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Your email" type="email" value={form.email} onChange={set('email')} />
        </div>
        <button type="submit" disabled={busy}>Notify me</button>
        {status && <p className="status">{status}</p>}
      </form>
    </div>
  )
}
