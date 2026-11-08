import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, EMPLOYEE_PLAN_KEY, EMPLOYEE_PLAN_PRICE } from '../lib/BusinessCartContext'
import { BusinessTopBar } from './BusinessMenu'
import DemoInterestPopup from './DemoInterestPopup'
import FloatingAddToCart from './FloatingAddToCart'

// Sales page for the employee time page (reached from More ▾ →
// Restaurants → Employee, and from the Employee submenu). One
// product only: a team's own page for employee time tracking, for
// $20/month. No card payment is taken here — the request form emails
// the owner, who then creates the team's link and login by hand.
// Nothing on this page promises instant signup. Connecting carts to
// the bank comes later.
//
// PRICE NOTE: the $20/month on this page is the assistant's choice
// mirroring the POS, Restaurants and Dealer pages — NOT confirmed by
// the owner, changeable on his word.
export default function EmployeePage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(EMPLOYEE_PLAN_KEY)
  const [form, setForm] = useState({ name: '', team: '', email: '', phone: '', message: '' })
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
        data: { car_id: null, car_name: 'Employee Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Employee request — ${form.name}`,
        emailExtras: { team_name: form.team.trim() },
      })
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your employee time page.')
      setForm({ name: '', team: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>⏰ Your team, clocked in online</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own employee time page for $20/month. No apps, no hardware, no commission.</p>
        <p>Your employees log their time from any phone — clock in, clock out, and every hour is recorded for the whole team to see.</p>
      </div>

      <div className="hero-card">
        <h3>What your team gets</h3>
        <ul>
          <li><b>Your own employee page</b> — your team's name, employees, jobs and hours. You'll get your own private link by email.</li>
          <li><b>Your employees list with jobs</b> — who works here, and what they work on.</li>
          <li><b>Time logging with a receipt for every log</b> — a code, name, date, clock in and out, and hours, for every log.</li>
          <li><b>Shared records the whole team sees</b> — every log in one place, no refresh.</li>
          <li><b>Two passwords</b> — your own login for Setup, where you change your page, and one shared password you give your staff for Log Time and Records.</li>
          <li><b>Your team, your control</b> — add, edit and delete employees yourself in Setup; they go live right away. Change the business details and send them for approval.</li>
          <li><b>No commission, ever</b> — you keep everything you earn. No hardware to buy, no app for your employees to install.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell Yently you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>You get your link and login</b> — your team's own username and password, plus the employee password for your staff.</li>
          <li><b>Add your employees in Setup, and start logging time.</b></li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$20/month.</b> That's it — your employee page, your time logs, and your records. No setup fee, no commission. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and Yently will be in touch to set up your employee time page.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Employee time page — ${EMPLOYEE_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(EMPLOYEE_PLAN_KEY)}>Add to cart — ${EMPLOYEE_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo team</h3>
        <p>See the time page working before you ask for one — the demo team is live, with the employee password <b>demo</b>.</p>
        <button type="button" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
      </div>

      {demoOpen && <DemoInterestPopup systemName="Employee time page" onClose={() => setDemoOpen(false)} />}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your employee time page</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input required placeholder="Team name" value={form.team} onChange={set('team')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your team (optional) — how many employees, what jobs, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>
      <FloatingAddToCart planKey={EMPLOYEE_PLAN_KEY} name="Employee time page" price={EMPLOYEE_PLAN_PRICE} go={go} />
    </div>
  )
}
