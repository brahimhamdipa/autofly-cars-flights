import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'

// "Notify me when it launches" signup box for the coming-soon pages.
// Every signup is saved (car_inquiries) and emailed to the owner, tagged
// per category, e.g. car_name = "Notify me (Groceries)".
export default function NotifyMe({ topic, withArea = false }) {
  const [email, setEmail] = useState('')
  const [area, setArea] = useState('')
  const [status, setStatus] = useState('')
  const [done, setDone] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus('Signing you up...')
    try {
      await submitAndNotify({
        table: 'car_inquiries',
        data: {
          car_id: null,
          car_name: `Notify me (${topic})`,
          name: 'Launch signup',
          email,
          phone: '',
          message: withArea && area ? `Area: ${area}` : '',
        },
        subject: `Notify me (${topic}) — new signup`,
      })
      setDone(true)
      setStatus('')
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
  }

  if (done) {
    return (
      <div className="form-card wide">
        <h3>✓ You're on the list!</h3>
        <p>We'll email you as soon as {topic} launches. Thanks for your interest!</p>
      </div>
    )
  }

  return (
    <form className="form-card wide" onSubmit={handleSubmit}>
      <h3>🔔 Notify me when it launches</h3>
      <p className="hint">Drop your email and we'll let you know as soon as {topic} is live.</p>
      <div className="row">
        <input required type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)} />
        {withArea && <input placeholder="Your city / area (optional)" value={area} onChange={e => setArea(e.target.value)} />}
      </div>
      <button type="submit">Notify me</button>
      {status && <p className="hint">{status}</p>}
    </form>
  )
}
