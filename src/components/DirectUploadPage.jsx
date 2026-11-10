import { useEffect, useRef, useState } from 'react'
import { useBusinessCart } from '../lib/BusinessCartContext'
import { submitAndNotify } from '../lib/notify'
import { BusinessTopBar } from './BusinessMenu'
import FloatingAddToCart from './FloatingAddToCart'

// Sales page for the Direct Upload add-on (reached from More ▾ →
// Business Systems → Add-ons → Direct Upload, and from the hub).
// $5/month, first month free. The customer requests it first — the
// form below inserts a direct_upload_requests row and emails the
// owner — and once Yently approves, the customer adds the plan to
// the cart (plan key 'direct:website'). While it is switched on for
// their store, every upload they send (new items, new cars, changes
// to their page) goes live straight away, with no approval wait —
// and every upload is still logged for the admin, so nothing is
// lost track of. Works for every Business System, Store sellers, Car
// sellers and all Yently Kids subjects. No payment is taken here,
// and nothing on this page explains how uploads are stored — only
// what happens when the customer sends them.
const DIRECT_PLAN_KEY = 'direct:website'
const DIRECT_PLAN_PRICE = 5

const SYSTEMS = [
  { label: 'Restaurant', value: 'diner' },
  { label: 'POS', value: 'pos' },
  { label: 'Barbershop', value: 'barbers' },
  { label: 'Dealer', value: 'dealer' },
  { label: 'Employee', value: 'employee' },
  { label: 'Bodyshop', value: 'bodyshop' },
  { label: 'Store', value: 'store' },
  { label: 'Cars', value: 'car-seller' },
  { label: 'Kids — Math', value: 'kids-math' },
  { label: 'Kids — English', value: 'kids-english' },
  { label: 'Kids — Arabic', value: 'kids-arabic' },
  { label: 'Kids — French', value: 'kids-french' },
  { label: 'Kids — Spanish', value: 'kids-spanish' },
  { label: 'Kids — Science', value: 'kids-science' },
  { label: 'Kids — Geography', value: 'kids-geography' },
  { label: 'Kids — Coding', value: 'kids-coding' },
  { label: 'Kids — Reading', value: 'kids-reading' },
]

function normSlug(v) {
  return String(v || '').toLowerCase().replace(/[^a-z0-9-]+/g, '').replace(/^-+|-+$/g, '')
}

// Plain, detailed explanations for every field — shown when the
// customer taps the "?" next to a label, so nobody has to guess how
// to fill the form in. Same pattern as the Store Setup page.
const HELP = {
  name: 'Your own name — the person asking for Direct Upload. Yently uses it to know who the request is from, and to address you in the reply. Type your first and last name.',
  business: 'The name of your store, restaurant, school or business — the name customers know you by. Yently uses it to match your request to your page. Type it the way it appears on your page.',
  email: 'Your email address — the one you actually read. Yently sends the answer here: approved or not, and the link to add Direct Upload to your cart. Double-check the spelling — one wrong letter and the reply never reaches you.',
  phone: 'Your phone number, so Yently can reach you quickly if something about your request is unclear. Digits only is fine — spaces or dashes do no harm.',
  system: 'Pick the kind of page Direct Upload is for. Restaurant is your restaurant page, POS is your till page, Barbershop your barber page, Dealer, Employee and Bodyshop the same idea. Store is your own store page, where you sell your items. Cars is selling cars, and Kids is one of the nine school subjects — pick the subject.',
  shopSlug: 'The word that identifies your page on Yently. It is the word after ?s= or ?r= in your page link — for example, if your link is yently.com/pos?s=demo-pos, the word is demo-pos. For Cars, type your seller username instead. Small letters only, no spaces — capitals and spaces are removed for you.',
  message: 'Anything else that helps — you can leave it empty. For example what you upload most (new dishes, new items, new words), or how often you upload. The more Yently knows, the faster the approval.',
}

// The "?" button next to a field label. Tap once to open the
// explanation under it, tap again — or tap anywhere else on the
// page — to close it. Only one help is open at a time: tapping
// another "?" closes this one first.
function Help({ text }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <span className="help" ref={ref}>
      <button type="button" className="help-btn" aria-label="Help" onClick={() => setOpen(o => !o)}>?</button>
      {open && <span className="help-pop">{text}</span>}
    </span>
  )
}

export default function DirectUploadPage({ go }) {
  const { hasPlan, addPlan } = useBusinessCart()
  const inCart = hasPlan(DIRECT_PLAN_KEY)
  const [form, setForm] = useState({ name: '', business: '', email: '', phone: '', system: '', shop_slug: '', message: '' })
  const [status, setStatus] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBusy(true)
    setStatus('Sending your request...')
    try {
      await submitAndNotify({
        table: 'direct_upload_requests',
        data: {
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone,
          business_name: form.business,
          system: form.system,
          shop_slug: normSlug(form.shop_slug),
          message: form.message || null,
        },
        subject: `New Direct Upload request — ${form.name}`,
      })
      setStatus('✓ Sent! Yently will look at your request — most are approved, and schools always are.')
      setForm({ name: '', business: '', email: '', phone: '', system: '', shop_slug: '', message: '' })
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setBusy(false)
  }

  return (
    <div>
      <BusinessTopBar go={go} />
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        <h2 style={{ color: '#fff' }}>🚀 Your uploads, live straight away</h2>
        <p style={{ fontSize: 18, color: '#f5c542' }}>Direct Upload — skip the wait. Your new items, cars and page changes go live the moment you send them.</p>
        <p>$5/month. First month free, cancel anytime.</p>
      </div>

      <form className="form-card wide" onSubmit={handleSubmit} style={{ border: '2px solid #f5c542' }}>
        <h3>Request Direct Upload</h3>
        <p>Fill this in — most requests are approved, and schools are always approved.</p>
        <div className="row">
          <div className="field">
            <span className="field-label">Your name <Help text={HELP.name} /></span>
            <input required placeholder="Your name" value={form.name} onChange={set('name')} />
          </div>
          <div className="field">
            <span className="field-label">Business name <Help text={HELP.business} /></span>
            <input required placeholder="Business name" value={form.business} onChange={set('business')} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <span className="field-label">Email <Help text={HELP.email} /></span>
            <input required placeholder="Email" type="email" value={form.email} onChange={set('email')} />
          </div>
          <div className="field">
            <span className="field-label">Phone <Help text={HELP.phone} /></span>
            <input required placeholder="Phone" value={form.phone} onChange={set('phone')} />
          </div>
        </div>
        <div className="row">
          <div className="field">
            <span className="field-label">Which page is this for? <Help text={HELP.system} /></span>
            <select required value={form.system} onChange={set('system')}>
              <option value="">Which page is this for?</option>
              {SYSTEMS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="field-label">Your page name on Yently <Help text={HELP.shopSlug} /></span>
            <input required placeholder="The word after ?s= or ?r= in your link, or your seller username for Cars" value={form.shop_slug} onChange={set('shop_slug')} />
          </div>
        </div>
        <div className="field">
          <span className="field-label">Message (optional) <Help text={HELP.message} /></span>
          <textarea className="big-message" placeholder="Anything that helps, like what you upload most" value={form.message} onChange={set('message')} />
        </div>
        <button type="submit" disabled={busy}>Send request</button>
        {status && <p className="status">{status}</p>}
      </form>

      <div className="hero-card">
        <h3>What you get</h3>
        <ul>
          <li><b>Live the moment you send it</b> — your new items, cars and page changes go live straight away. No waiting for approval, no checking back.</li>
          <li><b>Works on your whole page</b> — items, cars, menu, words, scores — whatever you upload, it goes live the same way.</li>
          <li><b>Yently still sees everything</b> — every upload is logged for Yently, so nothing disappears and nothing is lost track of.</li>
          <li><b>You keep the normal way too</b> — turn it off any time and your uploads go back to approval first. Nothing is locked in.</li>
          <li><b>One add-on covers your whole store or school</b> — one Direct Upload, for everything on that page.</li>
        </ul>
      </div>

      <div className="hero-card">
        <h3>How it works</h3>
        <ol className="steps">
          <li><b>Request it above</b> — tell Yently which page it is for.</li>
          <li><b>Yently approves</b> — most requests are approved, and schools are always approved.</li>
          <li><b>Add it to your cart</b> — $5/month, first month free — and from then on your uploads go live straight away.</li>
        </ol>
      </div>

      <div className="hero-card">
        <h3>Simple, honest pricing</h3>
        <p><b>$5/month.</b> That's it — Direct Upload, for one store or school. No setup fee. First month free, cancel anytime.</p>
        <p className="hint">Send your request above and Yently will be in touch once it is approved.</p>
      </div>

      <div className="hero-card" style={{ textAlign: 'center' }}>
        <h3>Direct Upload — ${DIRECT_PLAN_PRICE}/month</h3>
        {inCart ? (
          <div>
            <p>✓ In your cart.</p>
            <button onClick={() => go && go('business-cart')}>Go to My Cart</button>
          </div>
        ) : (
          <div>
            <button onClick={() => addPlan(DIRECT_PLAN_KEY)}>Add to cart — ${DIRECT_PLAN_PRICE}/month</button>
            <p className="hint">Add it once Yently approves your request above — most are approved, and schools always are.</p>
          </div>
        )}
      </div>

      <FloatingAddToCart planKey={DIRECT_PLAN_KEY} name="Direct Upload" price={DIRECT_PLAN_PRICE} go={go} />
    </div>
  )
}
