import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { fetchAll, fmtDate } from '../../lib/admin'

// Admin → menu 4 (Systems) → Add-ons → Live Chat Orders.
//
// Live Chat is a $3/month add-on: once it is on for a customer's
// page, the chat bubble appears on that page and their visitors can
// message them; the customer answers from the Chats tab in their
// Setup page. It is OFF by default for everyone — a customer can
// only get it by ordering it, and the admin switches it on here.
//
// ORDERS — every Live Chat order, newest first. An order row only
// carries the customer's name, email, phone, plan, price and
// checkout note — it does NOT say which system or shop the chat
// goes on, so there is no Approve button here: the admin turns a
// shop on from the Switches tab, by adding a switch for that
// shop's system + slug.
// SWITCHES — one row per shop with the switch on or off. The admin
// can flip a switch by hand or add one. OFF means no chat bubble
// on that shop's page. ON means the bubble is there and the owner
// answers from the Chats tab in Setup.
//
// Orders for Live Chat live in live_chat_order (singular) — the
// plural 'live_chat_orders' is only the menu key in AdminPage.jsx
// and the Manage-table key in AdminStoreManage.jsx; the real table
// the cart writes to is live_chat_order (see liveChatData.js).

const SYSTEM_OPTIONS = [
  'diner', 'pos', 'barbers', 'dealer', 'employee', 'bodyshop', 'houses',
  'doctor', 'holiday', 'rentals', 'laundry', 'store',
  'car-seller',
  'kids-math', 'kids-english', 'kids-arabic', 'kids-french', 'kids-spanish',
  'kids-science', 'kids-geography', 'kids-coding', 'kids-reading',
]

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

export default function AdminLiveChat() {
  const [view, setView] = useState('orders')
  const [orders, setOrders] = useState(null)
  const [switches, setSwitches] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [switchForm, setSwitchForm] = useState({ owner_type: 'diner', owner_key: '', notify_email: '', enabled: false })

  const loadOrders = async () => {
    try { setOrders(await fetchAll('live_chat_order')) }
    catch (e) { setError(e.message); setOrders([]) }
  }
  const loadSwitches = async () => {
    try {
      const { data, error: err } = await supabase
        .from('shop_chat_switches')
        .select('*')
        .order('updated_at', { ascending: false })
      if (err) throw err
      setSwitches(data || [])
    } catch (e) { setError(e.message); setSwitches([]) }
  }
  useEffect(() => { loadOrders(); loadSwitches() }, [])

  const toggleSwitch = async (row, enabled) => {
    setError('')
    const { error: err } = await supabase
      .from('shop_chat_switches')
      .update({ enabled, updated_at: new Date().toISOString() })
      .eq('owner_type', row.owner_type)
      .eq('owner_key', row.owner_key)
    if (err) { setError(err.message); return }
    setStatus(`✓ Chat for ${row.owner_key} (${row.owner_type}) is now ${enabled ? 'ON — the bubble appears on their page and they answer from the Chats tab in Setup.' : 'OFF — no chat bubble on their page.'}`)
    loadSwitches()
  }

  const addSwitch = async (e) => {
    e.preventDefault()
    setError('')
    setStatus('Saving switch...')
    const { error: err } = await supabase.from('shop_chat_switches').insert({
      owner_type: switchForm.owner_type,
      owner_key: switchForm.owner_key.trim(),
      notify_email: switchForm.notify_email.trim(),
      enabled: switchForm.enabled,
    })
    if (err) { setStatus(''); setError(err.message); return }
    setStatus(`✓ Chat switch saved for ${switchForm.owner_key} (${switchForm.owner_type}) — ${switchForm.enabled ? 'ON' : 'OFF'}.`)
    setSwitchForm({ owner_type: 'diner', owner_key: '', notify_email: '', enabled: false })
    loadSwitches()
  }

  return (
    <div>
      <div className="hero-card">
        <h2>💬 Live Chat</h2>
        <p>Live Chat is a $3/month add-on, first month free. When it is switched on for a customer's page, the chat bubble appears on that page and their visitors can message them — the owner answers from the Chats tab in their Setup page, and every message also reaches them by email. It is OFF by default for everyone.</p>
      </div>

      <div className="trip-tabs" style={{ marginBottom: 16 }}>
        <button type="button" className={view === 'orders' ? 'active' : ''} onClick={() => setView('orders')}>Orders</button>
        <button type="button" className={view === 'switches' ? 'active' : ''} onClick={() => setView('switches')}>Switches</button>
      </div>

      {status && <p className="status">{status}</p>}
      {error && <p className="status">Error: {error}</p>}

      {view === 'orders' && (
        <div>
          <p className="hint">An order row does not say which page the chat goes on — it only has the customer's name, email and phone. To switch a shop on, go to the Switches tab and add a switch for that shop's system and slug.</p>
          {orders === null && <div className="hero-card"><p>Loading orders...</p></div>}
          {orders !== null && orders.length === 0 && <p className="hint">No Live Chat orders yet.</p>}
          {orders !== null && orders.length > 0 && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>Date</th><th>Customer</th><th>Email</th><th>Phone</th><th>Plan</th><th>Price</th><th>Note</th></tr>
                </thead>
                <tbody>
                  {orders.map(o => (
                    <tr key={o.id}>
                      <td>{fmtDate(o.created_at)}</td>
                      <td>{o.customer_name}</td>
                      <td>{o.customer_email}</td>
                      <td>{o.customer_phone || ''}</td>
                      <td>{o.plan}</td>
                      <td>{o.price != null ? `$${o.price}` : ''}</td>
                      <td>{o.note || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === 'switches' && (
        <div>
          <p className="hint">OFF means no chat bubble on that shop's page. ON means the bubble appears on their page — and the owner answers their visitors from the Chats tab in their Setup page. Visitor messages also go to the notify email on the switch (or the email in the shop's own record, when it has one).</p>

          <form className="form-card wide" onSubmit={addSwitch}>
            <h3>Add a switch</h3>
            <div className="row">
              <select value={switchForm.owner_type} onChange={e => setSwitchForm({ ...switchForm, owner_type: e.target.value })}>
                {SYSTEM_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input required placeholder="Shop name (slug, e.g. demo-restaurant)" value={switchForm.owner_key} onChange={e => setSwitchForm({ ...switchForm, owner_key: e.target.value })} />
            </div>
            <div className="row">
              <input type="email" placeholder="Notify email — where visitor messages go (from the Live Chat order)" value={switchForm.notify_email} onChange={e => setSwitchForm({ ...switchForm, notify_email: e.target.value })} />
            </div>
            <div className="row">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={switchForm.enabled} onChange={e => setSwitchForm({ ...switchForm, enabled: e.target.checked })} />
                Switch on (the chat bubble appears on their page)
              </label>
            </div>
            <button type="submit">Save switch</button>
          </form>

          {switches === null && <div className="hero-card"><p>Loading switches...</p></div>}
          {switches !== null && switches.length === 0 && <p className="hint">No switches yet — every shop is OFF by default.</p>}
          {switches !== null && switches.length > 0 && (
            <div className="table-wrap">
              <table className="admin-table">
                <thead>
                  <tr><th>System</th><th>Shop</th><th>Notify email</th><th>Switch</th><th>Updated</th></tr>
                </thead>
                <tbody>
                  {switches.map(s => (
                    <tr key={`${s.owner_type}:${s.owner_key}`}>
                      <td>{s.owner_type}</td>
                      <td>{s.owner_key}</td>
                      <td>{s.notify_email || ''}</td>
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
    </div>
  )
}
