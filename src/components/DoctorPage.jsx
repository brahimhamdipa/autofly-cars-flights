import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, DOCTOR_PLAN_KEY, DOCTOR_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import DemoInterestPopup from './DemoInterestPopup'
import FloatingAddToCart from './FloatingAddToCart'

// Sales page for the doctor booking page (reached from More ▾ →
// Business Systems → Doctor). One product only: a clinic's own page
// with doctors, fees and appointments, for $20/month. No card payment
// is taken here — the request form emails the owner, who then creates
// the clinic's link and login by hand. Nothing on this page promises
// instant signup. Connecting carts to the bank comes later.
//
// PRICE NOTE: the $20/month on this page is the assistant's choice
// mirroring the other systems — NOT confirmed by the owner,
// changeable on his word.
export default function DoctorPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(DOCTOR_PLAN_KEY)
  const [form, setForm] = useState({ name: '', clinic: '', email: '', phone: '', message: '' })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setStatus('Sending your request...')
    try {
      await submitAndNotify({
        table: 'car_inquiries',
        data: { car_id: null, car_name: 'Doctor Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Doctor request — ${form.name}`,
        emailExtras: { clinic_name: form.clinic.trim() },
      })
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your clinic page.')
      setForm({ name: '', clinic: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🩺 Your clinic, booking online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own doctor booking page for $20/month. No apps, no hardware, no commission.</p>
        <p>Patients browse your doctors, see the fee and visit length, and book an appointment — all from any phone. You see every booking the moment it comes in.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>🎥 Watch how it works — 2 minutes</h3>
        <p>See what you get, how to get it, and how to use it — a quick video guide for clinics.</p>
        <video controls preload="metadata" poster="/videos/doctor-guide-poster.jpg" src="/videos/doctor-guide.mp4" style={{ width: '100%', maxWidth: 720, borderRadius: 10, background: '#000' }} />
        <p style={{ marginTop: 10 }}>Prefer to read it? <a href="/guides/doctor-guide.pdf" target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 700 }}>Download the step-by-step guide (PDF)</a> — from buying it to taking your first booking.</p>
      </div>

      <div className="hero-card">
        <h3>What your clinic gets</h3>
        <ul>
          <li><b>Your own clinic page</b> — your clinic's name, doctors, fees, hours and address. You'll get your own private link by email.</li>
          <li><b>Appointments booked online</b> — patients pick a doctor, a date and a time, and leave their name and phone. You see every booking in Bookings.</li>
          <li><b>Your doctors, your control</b> — add, edit, and delete doctors yourself in Setup; they go live right away. Change the clinic details and send them for approval.</li>
          <li><b>Two passwords</b> — your own login for Setup, where you change your page, and one shared password you give your staff for Bookings.</li>
          <li><b>Pay at the clinic</b> — booking here reserves the appointment; no payment is taken online.</li>
          <li><b>No commission, ever</b> — you keep everything you earn. No hardware to buy, no app for patients to install.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell Yently you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>You get your link and login</b> — your clinic's own username and password, plus the employee password for your staff.</li>
          <li><b>Add your doctors in Setup, and start booking.</b></li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$20/month.</b> That's it — your clinic page, your doctors, and your appointments. No setup fee, no commission on your visits. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and Yently will be in touch to set up your clinic.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Doctor booking page — ${DOCTOR_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(DOCTOR_PLAN_KEY)}>Add to cart — ${DOCTOR_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo clinic</h3>
        <p>See the doctor page working before you ask for one — tap below and we'll send you the demo link.</p>
        <button type="button" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
      </div>

      {demoOpen && <DemoInterestPopup systemName="Doctor booking page" onClose={() => setDemoOpen(false)} />}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your clinic online</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Clinic name" value={form.clinic} onChange={set('clinic')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your clinic (optional) — how many doctors, what you treat, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>
      <FloatingAddToCart planKey={DOCTOR_PLAN_KEY} name="Doctor booking page" price={DOCTOR_PLAN_PRICE} go={go} />
    </div>
  )
}
