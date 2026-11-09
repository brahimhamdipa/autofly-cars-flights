import { useState } from 'react'
import { submitAndNotify } from '../lib/notify'
import { useBusinessCart, KIDS_SCIENCE_PLAN_KEY, KIDS_SCIENCE_PLAN_PRICE } from '../lib/BusinessCartContext'
import { KidsTopBar } from './KidsMenu'
import FloatingAddToCart from './FloatingAddToCart'
import DemoInterestPopup from './DemoInterestPopup'

// Sales page for the Kids Science page (reached from More ▾ → Yently
// Kids → Science). One product only: a learning page for children, with
// a Play area for the kids, a Teacher area with every score, and a Setup
// the owner edits (draft → approval, like the other folder systems).
// $10/month, first month free. No card payment is taken here — the
// request form emails the owner, who then creates the school page and
// its link by hand, and the Add to cart card puts a kids_science_order row
// in front of the owner the same way (shared Business cart,
// BusinessCartContext + kids_science_order table, same pattern as the
// other Business Systems pages). Nothing on this page promises instant
// signup. Connecting carts to the bank comes later.
export default function KidsSciencePage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(KIDS_SCIENCE_PLAN_KEY)
  const [form, setForm] = useState({ name: '', school: '', email: '', phone: '', message: '' })
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
        data: { car_id: null, car_name: 'Kids Science Request', name: form.name, email: form.email, phone: form.phone, message: form.message },
        subject: `Kids Science request — ${form.name}`,
        emailExtras: { school_name: form.school.trim() },
      })
      setStatus('✓ Sent! Thanks — Yently will be in touch to set up your Kids Science page.')
      setForm({ name: '', school: '', email: '', phone: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <KidsTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🔬 Science that makes kids ask why</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Your own Kids Science page for $10/month — quizzes by topic, with a fun fact in every answer.</p>
        <p>Learning that feels like play — your children learn, you see every score.</p>
      </div>

      <div className="hero-card">
        <h3>What you get</h3>
        <ul>
          <li><b>Quizzes by topic</b> — Animals, Space, the Human Body, Plants, and Earth &amp; Weather, each with three levels.</li>
          <li><b>A fun fact with every answer</b> — the game teaches, not just tests.</li>
          <li><b>Your topics, your questions</b> — add topics and write your own questions in Setup, with the facts to go with them.</li>
          <li><b>See every score</b> — the Teacher area shows who played, what they played, and how they did.</li>
          <li><b>Your own private link</b> — you'll get your own private link by email. Only people you share it with can open your school page.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Tell Yently you want it</b> — fill in the form below, or simply Add to cart.</li>
          <li><b>You get your link and login</b> — your own school page, plus the teacher login.</li>
          <li><b>Add your students in Setup, share the link, and the kids start playing</b> — scores appear in the Teacher area.</li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$10/month.</b> That's it — your own Kids Science page, your students, and the teacher progress view. No setup fee. First month free, cancel anytime.</p>
        <p className="hint">Send your request below and Yently will be in touch to set up your Kids Science page.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Kids Science page — ${KIDS_SCIENCE_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <button onClick={() => addPlan(KIDS_SCIENCE_PLAN_KEY)}>Add to cart — ${KIDS_SCIENCE_PLAN_PRICE}/month</button>
        )}
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Try the demo school</h3>
        <p>See the Kids Science page working before you ask for one — the demo school is live, with the login <b>demo</b>.</p>
        <button type="button" onClick={() => setDemoOpen(true)}>Interested in a demo?</button>
      </div>

      {demoOpen && <DemoInterestPopup systemName="Kids Science page" onClose={() => setDemoOpen(false)} />}

      <form className="form-card wide" onSubmit={handleSubmit}>
        <h3>Get your Kids Science page</h3>
        <div className="row">
          <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          <input placeholder="School name (optional)" value={form.school} onChange={set('school')} />
        </div>
        <div className="row">
          <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
        </div>
        <textarea className="big-message" placeholder="Tell us about your class (optional) — how many children, what ages, anything that helps" value={form.message} onChange={set('message')} />
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>

      <FloatingAddToCart planKey={KIDS_SCIENCE_PLAN_KEY} name="Kids Science page" price={KIDS_SCIENCE_PLAN_PRICE} go={go} />
    </div>
  )
}
