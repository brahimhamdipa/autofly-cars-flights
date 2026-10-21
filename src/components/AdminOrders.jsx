import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { fetchAll, fmtDate } from '../lib/admin'
import { money } from './CartCheckout'

const STATUSES = ['pending', 'confirmed', 'done', 'cancelled']
const PAYMENTS = ['unpaid', 'paid', 'refunded']

// Orders manager: every grocery order, with status and payment dropdowns
// that save straight back to the database.
export default function AdminOrders() {
  const [orders, setOrders] = useState([])
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const load = async () => {
    try { setOrders(await fetchAll('grocery_orders')) }
    catch (e) { setError(e.message) }
  }
  useEffect(() => { load() }, [])

  const update = async (order, field, value) => {
    setStatus(`Saving order #${order.id}...`)
    const { error: err } = await supabase.from('grocery_orders').update({ [field]: value }).eq('id', order.id)
    if (err) { setStatus('Error: ' + err.message); return }
    setOrders(list => list.map(o => (o.id === order.id ? { ...o, [field]: value } : o)))
    setStatus(`✓ Order #${order.id} updated.`)
  }

  const itemsText = (items) =>
    Array.isArray(items) ? items.map(i => `${i.qty} × ${i.name} (${money(i.price)})`).join(' · ') : ''

  return (
    <div>
      <div className="hero-card">
        <h2>🧾 Orders</h2>
        <p>Every order from the Groceries shop, newest first. Change the status as you work through them (pending → confirmed → done) and mark orders paid when the money arrives.</p>
        {error && <p className="status">Couldn't load orders: {error}</p>}
        {status && <p className="status">{status}</p>}
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr><th>#</th><th>Date</th><th>Customer</th><th>Contact</th><th>Type</th><th>Items</th><th>Total</th><th>Status</th><th>Payment</th></tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.id}>
                <td>{o.id}</td>
                <td>{fmtDate(o.created_at)}</td>
                <td><b>{o.customer_name}</b>{o.fulfillment === 'delivery' && o.delivery_address ? <><br /><small>{o.delivery_address}</small></> : null}</td>
                <td><small>{o.customer_email}<br />{o.customer_phone}</small></td>
                <td>{o.fulfillment}</td>
                <td><small>{itemsText(o.items)}</small></td>
                <td><b>{money(o.total)}</b></td>
                <td>
                  <select value={o.status} onChange={e => update(o, 'status', e.target.value)}>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td>
                  <select value={o.payment_status} onChange={e => update(o, 'payment_status', e.target.value)}>
                    {PAYMENTS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={9}>No orders yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
