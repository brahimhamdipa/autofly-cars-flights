import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fetchAll, fmtDate } from '../../lib/admin'

// Admin → menu 4 (Business Systems) → Add-ons → Direct Upload.
//
// Direct Upload is a $5/month add-on: once it is on for a customer,
// their uploads go live straight away, with no admin approval step.
// It is OFF by default for everyone — a customer can only get it by
// requesting it here, and the admin approves or denies the request.
//
// REQUESTS — every request, newest first. Pending rows get Approve
// (green) + Deny. Approving calls the review RPC (which flips the
// customer's switch ON) and emails the customer the approval with
// the pay link; denying emails a polite refusal. If the email fails,
// the review decision is still saved — the status line says so.
// SWITCHES — one row per customer with the switch on or off. The
// admin can flip a switch by hand or add one. OFF means uploads
// from that customer wait for approval, as always.
// ACTIVITY — every upload that went live straight away because the
// switch was on, newest first, so nothing is ever lost track of.
//
// Orders for Direct Upload go through the generic Manage table
// (direct_upload_orders), not this page.

const SYSTEM_OPTIONS = [
  'diner', 'pos', 'barbers', 'dealer', 'employee', 'bodyshop', 'houses',
  'doctor', 'holiday', 'rentals', 'store',
  'car-seller',
  'kids-math', 'kids-english', 'kids-arabic', 'kids-french', 'kids-spanish',
  'kids-science', 'kids-geography', 'kids-coding', 'kids-reading',
]

const PAY_LINK = 'https://yently.com/direct-upload'

function Switch({ on, disabled, onToggle }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.6 : 1 }}>
      <input
        type="checkbox"
        checked={!!on}
        disabled={disabled}
        onChange={e => onToggle(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
      />
      <span style={{
        display: 'inline-block', width: 44, height: 24, borderRadius: 999,
        background: on ? '#16a34a' : '#d1d5db', position: 'relative',
        transition: 'background 0.2s', flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 3, left: on ? 23 : 3, width: 18, height: 18,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </span>
      <b style={{ color: on ? '#16a34a' : '#6b7280' }}>{on ? 'ON' : 'OFF'}</b>
    </label>
  )
}

export default function AdminDirectUpload() {
  const [view, setView] = useState('requests')
  const [requests, setRequests] = useState(null)
  const [switches, setSwitches] = useState(null)
  const [activity, setActivity] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [confirmDeny, setConfirmDeny] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [switchForm, setSwitchForm] = useState({ owner_type: 'diner', owner_key: '', enabled: false })

  const loadRequests = async () => {
    try { setRequests(await fetchAll('direct_upload_requests')) }
    catch (e) { setError(e.message); setRequests([]) }
  }
  const loadSwitches = async () => {
    try {
      const { data, error: err } = await supabase
        .from('direct_upload_switches')
        .select('*')
        .order('updated_at', { ascending: false })
      if (err) throw err
      setSwitches(data || [])
    } catch (e) { setError(e.message); setSwitches([]) }
  }
  const loadActivity = async () => {
    try {
      const { data, error: err } = await supabase
        .from('direct_upload_activity')
        .select('*')
        .order('created_at', { ascending: false })
      if (err) throw err
      setActivity(data || [])
    } catch (e) { setError(e.message); setActivity([]) }
  }
  useEffect(() => { loadRequests(); loadSwitches(); loadActivity() }, [])

  const sendEmail = async ({ to, subject, record }) => {
    const { error: err } = await supabase.functions.invoke('send-notification', {
      body: { to, subject, table: 'direct_upload_requests', record },
    })
    if (err) throw err
  }

  const review = async (row, approve) => {
    setError('')
    setBusyId(row.id)
    setStatus(approve ? 'Approving...' : 'Denying...')
    const { error: rpcErr } = await supabase.rpc('review_direct_upload_request', {
      p_request_id: row.id,
      p_approve: approve,
    })
    if (rpcErr) { setStatus(''); setError(rpcErr.message); setBusyId(null); return }
    // The review is saved now. If the email fails, say so — the decision stands.
    try {
      if (approve) {
        await sendEmail({
          to: row.customer_email,
          subject: 'Your Direct Upload request is approved',
          record: {
            customer_name: row.customer_name,
            plan: 'Direct Upload',
            price: 5,
            pay_link: PAY_LINK,
            message: `Good news — your Direct Upload request is approved. Your uploads will now go live straight away, no waiting for approval. To finish, add Direct Upload to your cart here: ${PAY_LINK} — $5/month, first month free.`,
          },
        })
        setStatus('✓ Approved — switch is on and the customer has been emailed the pay link.')
      } else {
        await sendEmail({
          to: row.customer_email,
          subject: 'Your Direct Upload request',
          record: {
            customer_name: row.customer_name,
            plan: 'Direct Upload',
            message: "Thanks for asking about Direct Upload. We can't switch it on for your page right now, but nothing changes for you — just keep sending your uploads the usual way and Yently will check each one before it goes live, as always. If anything changes, ask again any time.",
          },
        })
        setStatus('✓ Denied — the customer has been emailed.')
      }
    } catch (e) {
      setStatus(approve
        ? '✓ Approved — the switch is on, but the email failed to send. The approval is saved; email the customer by hand.'
        : '✓ Denied — the refusal is saved, but the email failed to send. Email the customer by hand.')
      setError(`Email error: ${e.message}`)
    }
    setConfirmDeny(null)
    setBusyId(null)
    loadRequests()
    loadSwitches()
  }

  const deny = (row) => {
    if (confirmDeny !== row.id) { setConfirmDeny(row.id); return }
    setConfirmDeny(null)
    review(row, false)
  }

  const toggleSwitch = async (row, enabled) => {
    setError('')
    const { error: err } = await supabase
      .from('direct_upload_switches')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('owner_type', row.owner_type)
      .eq('owner_key', row.owner_key)
    if (err) { setError(err.message); return }
    setStatus(`✓ Switch for ${row.owner_key} (${row.owner_type}) is now ${enabled ? 'ON — uploads go live straight away.' : 'OFF — uploads wait for approval, as always.'}`)
    loadSwitches()
  }

  const addSwitch = async (e) => {
    e.preventDefault()
    setError('')
    setStatus('Saving switch...')
    const { error: err } = await supabase.from('direct_upload_switches').insert({
      owner_type: switchForm.owner_type,
      owner_key: switchForm.owner_key.trim(),
      enabled: switchForm.enabled,
    })
    if (err) { setStatus(''); setError(err.message); return }
    setStatus(`✓ Switch saved for ${switchForm.owner_key} (${switchForm.owner_type}) — ${switchForm.enabled ? 'ON' : 'OFF'}.`)
    setSwitchForm({ owner_type: 'diner', owner_key: '', enabled: false })
    loadSwitches()
  }

  const pending = (requests || []).filter(r => r.status === 'pending')
  const decided = (requests || []).filter(r => r.status !== 'pending')

  return (
    <div>
      <div className="hero-card">
        <h2>⚡ Direct Upload</h2>
        <p>Direct Upload is a $5/month add-on. A customer requests it, you approve it here, and from then on their uploads go live straight away — no approval step. It is OFF by default for everyone, and every straight-to-live upload is still listed under Activity, so nothing is lost track of.</p>
      </div>

      <div className="trip-tabs" style={{ marginBottom: 16 }}>
        <button type="button" className={view === 'requests' ? 'active' : ''} onClick={() => setView('requests')}>Requests {pending.length > 0 && `(${pending.length} pending)`}</button>
        <button type="button" className={view === 'switches' ? 'active' : ''} onClick={() => setView('switches')}>Switches</button>
        <button type="button" className={view === 'activity' ? 'active' : ''} onClick={() => setView('activity')}>Activity</button>
      </div>

      {status && <p className="status">{status}</p>}
      {error && <p className="status">Error: {error}</p>}

      {view === 'requests' && (
        <div>
          {requests === null && <div className="hero-card"><p>Loading requests...</p></div>}
          {requests !== null && pending.length === 0 && <p className="hint">No requests waiting — everything has been decided.</p>}
          {pending.length > 0 && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Date</th><th>Customer</th><th>Business</th><th>Email</th><th>Phone</th><th>System</th><th>Shop</th><th>Message</th><th className="no-print"></th></tr>
                </thead>
                <tbody>
                  {pending.map(r => (
                    <tr key={r.id}>
                      <td>{fmtDate(r.created_at)}</td>
                      <td>{r.customer_name}</td>
                      <td>{r.business_name || ''}</td>
                      <td>{r.customer_email}</td>
                      <td>{r.customer_phone || ''}</td>
                      <td>{r.system}</td>
                      <td>{r.shop_slug}</td>
                      <td>{r.message || ''}</td>
                      <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn-mini"
                          style={{ background: '#16a34a', color: '#fff' }}
                          disabled={busyId === r.id}
                          onClick={() => review(r, true)}
                        >Approve</button>{' '}
                        <button
                          type="button"
                          className="btn-mini btn-danger"
                          disabled={busyId === r.id}
                          onClick={() => deny(r)}
                        >{confirmDeny === r.id ? 'Tap again to confirm' : 'Deny'}</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {decided.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3>Decided</h3>
              <div className="table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr><th>Date</th><th>Customer</th><th>Business</th><th>Email</th><th>System</th><th>Shop</th><th>Status</th><th>Reviewed</th></tr>
                  </thead>
                  <tbody>
                    {decided.map(r => (
                      <tr key={r.id}>
                        <td>{fmtDate(r.created_at)}</td>
                        <td>{r.customer_name}</td>
                        <td>{r.business_name || ''}</td>
                        <td>{r.customer_email}</td>
                        <td>{r.system}</td>
                        <td>{r.shop_slug}</td>
                        <td>{r.status}</td>
                        <td>{fmtDate(r.reviewed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'switches' && (
        <div>
          <p className="hint">OFF means uploads from this customer wait for approval, as always. ON means their uploads go live straight away — and every one is still listed under Activity below, so nothing is lost track of.</p>

          <form className="form-card wide" onSubmit={addSwitch}>
            <h3>Add a switch</h3>
            <div className="row">
              <select value={switchForm.owner_type} onChange={e => setSwitchForm({ ...switchForm, owner_type: e.target.value })}>
                {SYSTEM_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input required placeholder="Shop name (slug, e.g. demo-restaurant)" value={switchForm.owner_key} onChange={e => setSwitchForm({ ...switchForm, owner_key: e.target.value })} />
            </div>
            <div className="row">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={switchForm.enabled} onChange={e => setSwitchForm({ ...switchForm, enabled: e.target.checked })} />
                Switch on (uploads go live straight away)
              </label>
            </div>
            <button type="submit">Save switch</button>
          </form>

          {switches === null && <div className="hero-card"><p>Loading switches...</p></div>}
          {switches !== null && switches.length === 0 && <p className="hint">No switches yet — every customer is OFF by default.</p>}
          {switches !== null && switches.length > 0 && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>System</th><th>Shop</th><th>Switch</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {switches.map(s => (
                    <tr key={`${s.owner_type}:${s.owner_key}`}>
                      <td>{s.owner_type}</td>
                      <td>{s.owner_key}</td>
                      <td><Switch on={s.enabled} onToggle={v => toggleSwitch(s, v)} /></td>
                      <td>{fmtDate(s.updated_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'activity' && (
        <div>
          <p className="hint">Every upload that went live straight away, because the switch was on.</p>
          {activity === null && <div className="hero-card"><p>Loading activity...</p></div>}
          {activity !== null && activity.length === 0 && <p className="hint">Nothing has gone straight to live yet.</p>}
          {activity !== null && activity.length > 0 && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Date</th><th>System</th><th>Shop</th><th>Kind</th><th>Detail</th></tr>
                </thead>
                <tbody>
                  {activity.map(a => (
                    <tr key={a.id || `${a.created_at}:${a.owner_key}:${a.kind}`}>
                      <td>{fmtDate(a.created_at)}</td>
                      <td>{a.owner_type}</td>
                      <td>{a.owner_key}</td>
                      <td>{a.kind}</td>
                      <td>{a.detail || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
