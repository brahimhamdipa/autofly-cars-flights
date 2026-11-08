import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { loadBarberPageData, insertBarberReservation } from '../lib/barberData'

// Public barber template page, reached at yently.com/<slug> when
// the slug matches a website_domain row (see the ProviderFormPage
// edit: the domain check runs first, so this page needs NO login).
// Three parts, all driven by the tables: Header (website_header),
// Body (website_body + the store's styles, locations and hours),
// Footer (website_footer). The reservation form at the bottom works
// like the Shopping/Cars/Flights Contact Us forms and adds a Great
// Clips-style online check-in: pick a service and a day, see your
// place in line BEFORE you book, then submit and the store gets an
// email. No SMS is sent or promised anywhere here — the store's
// text_message flag is data for later, not a feature of this page.
const money = (n) => '$' + Number(n || 0).toFixed(2)

const DAYS = [
  ['monday', 'Monday'], ['tuesday', 'Tuesday'], ['wednesday', 'Wednesday'],
  ['thursday', 'Thursday'], ['friday', 'Friday'], ['saturday', 'Saturday'],
  ['sunday', 'Sunday'],
]

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function BarberTemplatePage({ domain, goBack }) {
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [styleId, setStyleId] = useState('')
  const [date, setDate] = useState(todayStr())
  const [time, setTime] = useState('')
  const [note, setNote] = useState('')

  const [wait, setWait] = useState(null)
  const [waitLoading, setWaitLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState('')
  const [placed, setPlaced] = useState(null)

  useEffect(() => {
    if (!domain?.id) return
    setLoading(true)
    loadBarberPageData(domain.id)
      .then(setPage)
      .catch(e => setLoadError(e.message))
      .finally(() => setLoading(false))
  }, [domain?.id])

  // The queue estimate refreshes whenever the picked service or day
  // changes (and on first load). The RPC only knows today's queue, so for a future
  // day the line below says there is no queue yet for that day instead
  // of showing today's numbers for the wrong day.
  const refreshWait = async (storeId) => {
    if (!storeId) return
    setWaitLoading(true)
    try {
      const { data, error } = await supabase.rpc('barber_wait_estimate', { p_store_id: storeId })
      if (!error && data) setWait(data)
    } catch { /* keep the previous estimate */ }
    setWaitLoading(false)
  }
  useEffect(() => { if (page?.store?.id) refreshWait(page.store.id) }, [page?.store?.id, date, styleId]) // eslint-disable-line react-hooks/exhaustive-deps

  const waitLine = () => {
    if (waitLoading) return 'Checking today\u2019s queue\u2026'
    if (!wait) return ''
    if (date !== todayStr()) return 'No queue yet for that day \u2014 book ahead and we will confirm your time.'
    if (wait.queue_count > 0) return `About ${wait.wait_minutes} minutes wait \u00b7 ${wait.queue_count} ${wait.queue_count === 1 ? 'person' : 'people'} ahead of you.`
    return 'No wait right now \u2014 book and come on in.'
  }

  const submit = async (e) => {
    e.preventDefault()
    setSubmitting(true); setStatus('')
    const style = (page.styles || []).find(s => String(s.id) === String(styleId))
    try {
      await insertBarberReservation({
        store_id: page.store.id,
        domain_id: page.domain.id,
        style_id: style ? style.id : null,
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        reservation_date: date,
        reservation_time: time,
        note,
      }, page.store.email, {
        store: page.store.store_name,
        service: style ? style.name : 'No service picked yet',
        wait: waitLine(),
      })
      setPlaced({ name, date, time, styleName: style ? style.name : null, wait: waitLine() })
      setStatus('')
      refreshWait(page.store.id)
    } catch (err) {
      setStatus('Error: ' + err.message)
    }
    setSubmitting(false)
  }

  if (loading) return (<div><div className="hero-card"><p>Loading…</p></div></div>)
  if (loadError || !page) return (<div><div className="hero-card"><p>Couldn’t load this page: {loadError || 'not found'}</p></div></div>)

  const { store, locations, openTime, styles, header, body, footer } = page
  const logo = header?.header_logo?.[0]
  const footLogo = footer?.footer_logo?.[0]

  return (
    <div>
      {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}

      {/* Header */}
      <div className="hero-card" style={{ background: '#161d44', color: '#fff', textAlign: 'center' }}>
        {logo
          ? <img src={logo} alt={header.header_name || store.store_name} style={{ maxWidth: 220, maxHeight: 120, objectFit: 'contain' }} />
          : <h2 style={{ color: '#fff' }}>{header?.header_name || store.store_name}</h2>}
        {header?.header_slogan && <p style={{ fontSize: 18, color: '#f5c542' }}>{header.header_slogan}</p>}
        {header?.header_description && <p>{header.header_description}</p>}
        {header?.header_note && <p className="hint" style={{ color: '#ddd' }}>{header.header_note}</p>}
        <p style={{ marginTop: 12 }}>
          {store.tel ? <span>📞 {store.tel} &nbsp;</span> : null}
          {store.email ? <span>✉️ {store.email}</span> : null}
        </p>
        {store.about && <p>{store.about}</p>}
        {(store.pics || []).length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
            {store.pics.slice(0, 4).map((u, i) => (
              <img key={i} src={u} alt="" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8 }} />
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="hero-card">
        {body?.h1 && <h2>{body.h1}</h2>}
        {body?.text1 && <p>{body.text1}</p>}
        {body?.description && <p>{body.description}</p>}
        {body?.note && <p className="hint">{body.note}</p>}
      </div>

      {styles.length > 0 && (
        <div className="hero-card">
          {body?.h2 && <h3>{body.h2}</h3>}
          {styles.map(s => (
            <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #eee' }}>
              {(s.pics || [])[0] && <img src={s.pics[0]} alt={s.name} style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8 }} />}
              <div>
                <b>{s.name}</b>{s.price !== null && s.price !== undefined ? ` — ${money(s.price)}` : ''}{s.time_to_finish ? ` · about ${s.time_to_finish} min` : ''}
                {s.description && <div>{s.description}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {locations.length > 0 && (
        <div className="hero-card">
          {body?.h3 && <h3>{body.h3}</h3>}
          {locations.map(l => (
            <p key={l.id}>
              {[l.address, l.city, l.state, l.zip, l.country].filter(Boolean).join(', ')}
              {l.township ? ` (${l.township})` : ''}{l.county ? ` — ${l.county}` : ''}
              {l.note ? <><br /><span className="hint">{l.note}</span></> : null}
            </p>
          ))}
        </div>
      )}

      {openTime && (
        <div className="hero-card">
          {body?.h4 && <h3>{body.h4}</h3>}
          <table className="admin-table">
            <tbody>
              {DAYS.map(([key, label]) => (
                <tr key={key}><td>{label}</td><td>{openTime[key] || '—'}</td></tr>
              ))}
            </tbody>
          </table>
          {openTime.closed && <p className="hint">Closed: {openTime.closed}</p>}
          {openTime.hours_may_differ && <p className="hint">Hours may differ on holidays — call ahead to be sure.</p>}
        </div>
      )}

      {(body?.h5 || body?.text2 || body?.text3 || body?.text4 || body?.text5) && (
        <div className="hero-card">
          {body?.h5 && <h3>{body.h5}</h3>}
          {body?.text2 && <p>{body.text2}</p>}
          {body?.text3 && <p>{body.text3}</p>}
          {body?.text4 && <p>{body.text4}</p>}
          {body?.text5 && <p>{body.text5}</p>}
        </div>
      )}

      {/* Reservation — online check-in */}
      <div className="hero-card">
        <h3>✂️ Book / check in</h3>
        <p>Add your name, pick a service and a day, and see your place in line before you book. The store gets an email as soon as you submit.</p>
        <p><b>{waitLine()}</b></p>
      </div>
      {placed ? (
        <div className="hero-card">
          <h3>✓ You are in line, {placed.name}!</h3>
          <p>
            {placed.styleName ? <>Service: {placed.styleName}<br /></> : null}
            Day: {placed.date}{placed.time ? ` at ${placed.time}` : ''}<br />
            {placed.wait}
          </p>
          <p>The store has been emailed. Book another visit below if you like.</p>
          <button onClick={() => setPlaced(null)}>Book another</button>
        </div>
      ) : (
        <form onSubmit={submit} className="form-card">
          <label>Your name
            <input required placeholder="Full name" value={name} onChange={e => setName(e.target.value)} />
          </label>
          <label>Email
            <input required placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </label>
          <label>Phone
            <input required placeholder="Phone" value={phone} onChange={e => setPhone(e.target.value)} />
          </label>
          <label>Service
            <select value={styleId} onChange={e => setStyleId(e.target.value)}>
              <option value="">— Any service —</option>
              {styles.map(s => (
                <option key={s.id} value={s.id}>{s.name}{s.price !== null && s.price !== undefined ? ` — ${money(s.price)}` : ''}{s.time_to_finish ? ` · about ${s.time_to_finish} min` : ''}</option>
              ))}
            </select>
          </label>
          <label>Day
            <input required type="date" value={date} onChange={e => setDate(e.target.value)} />
          </label>
          <label>Preferred time
            <input type="time" value={time} onChange={e => setTime(e.target.value)} />
          </label>
          <label>Note (optional)
            <textarea placeholder="Anything the barber should know" value={note} onChange={e => setNote(e.target.value)} />
          </label>
          <p><b>{waitLine()}</b></p>
          <button type="submit" disabled={submitting}>{submitting ? 'Booking…' : 'Book / join the line'}</button>
          {status && <p className="status">{status}</p>}
        </form>
      )}

      {/* Footer */}
      <div className="hero-card" style={{ background: '#1e2a5a', color: '#fff', textAlign: 'center' }}>
        {footLogo
          ? <img src={footLogo} alt={footer.footer_name || store.store_name} style={{ maxWidth: 180, maxHeight: 100, objectFit: 'contain' }} />
          : <h3 style={{ color: '#fff' }}>{footer?.footer_name || store.store_name}</h3>}
        {footer?.footer_slogan && <p style={{ color: '#f5c542' }}>{footer.footer_slogan}</p>}
        {footer?.footer_description && <p>{footer.footer_description}</p>}
        {footer?.footer_note && <p className="hint" style={{ color: '#ddd' }}>{footer.footer_note}</p>}
      </div>
    </div>
  )
}
