import { useEffect, useState } from 'react'
import { fetchAll, fmtDate } from '../lib/admin'
import { money, priceOf } from './CartCheckout'

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

// Business overview: store health (products, stock, inventory value),
// sales (orders, revenue), and everything coming in through the site's
// forms. Print from the Admin header for a PDF report.
export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [errors, setErrors] = useState({})

  useEffect(() => {
    const load = async (key, table) => {
      try { return [key, await fetchAll(table)] }
      catch (e) { setErrors(prev => ({ ...prev, [key]: e.message })); return [key, []] }
    }
    Promise.all([
      load('products', 'grocery_products'),
      load('orders', 'grocery_orders'),
      load('sell', 'car_sell_requests'),
      load('inquiries', 'car_inquiries'),
      load('flights', 'flight_bookings'),
    ]).then(entries => setData(Object.fromEntries(entries)))
  }, [])

  if (!data) return <div className="hero-card"><p>Loading your business report...</p></div>

  const { products, orders, sell, inquiries, flights } = data
  const totalUnits = products.reduce((s, p) => s + (p.stock || 0), 0)
  const inventoryValue = products.reduce((s, p) => s + (p.stock || 0) * priceOf(p), 0)
  const lowStock = products.filter(p => p.stock > 0 && p.stock <= 10)
  const outStock = products.filter(p => p.stock <= 0)
  const liveOrders = orders.filter(o => o.status !== 'cancelled')
  const revenue = liveOrders.reduce((s, o) => s + Number(o.total || 0), 0)
  const pendingOrders = orders.filter(o => o.status === 'pending').length
  const deliveries = liveOrders.filter(o => o.fulfillment === 'delivery').length
  const pickups = liveOrders.filter(o => o.fulfillment === 'pickup').length
  const tagCounts = {}
  for (const i of inquiries) tagCounts[i.car_name || '(no tag)'] = (tagCounts[i.car_name || '(no tag)'] || 0) + 1
  const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const reportDate = new Date().toLocaleString()

  return (
    <div>
      <div className="hero-card">
        <h2>📊 Business Report</h2>
        <p>Generated {reportDate} — everything happening on AutoFly.us.com: store, stock, orders and form submissions.</p>
        {Object.entries(errors).map(([k, m]) => <p key={k} className="status">Couldn't load {k}: {m}</p>)}
      </div>

      <h3 className="admin-h3">🛒 Grocery store</h3>
      <div className="stat-grid">
        <StatCard label="Products" value={products.length} sub={`${products.filter(p => p.display !== false).length} shown on the Groceries page`} />
        <StatCard label="Units in stock" value={totalUnits} />
        <StatCard label="Inventory value" value={money(inventoryValue)} sub="stock × selling price" />
        <StatCard label="Low stock (≤ 10)" value={lowStock.length} sub={lowStock.map(p => p.name).join(', ') || 'none'} />
        <StatCard label="Out of stock" value={outStock.length} sub={outStock.map(p => p.name).join(', ') || 'none'} />
      </div>

      <h3 className="admin-h3">🧾 Sales</h3>
      <div className="stat-grid">
        <StatCard label="Orders" value={orders.length} sub={`${pendingOrders} waiting for action`} />
        <StatCard label="Revenue (not cancelled)" value={money(revenue)} />
        <StatCard label="Deliveries" value={deliveries} />
        <StatCard label="Pickups" value={pickups} />
      </div>

      {orders.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>#</th><th>Date</th><th>Customer</th><th>Items</th><th>Total</th><th>Type</th><th>Status</th><th>Paid</th></tr></thead>
            <tbody>
              {orders.slice(0, 10).map(o => (
                <tr key={o.id}>
                  <td>{o.id}</td><td>{fmtDate(o.created_at)}</td><td>{o.customer_name}</td>
                  <td>{Array.isArray(o.items) ? o.items.reduce((s, i) => s + (i.qty || 0), 0) : 0}</td>
                  <td>{money(o.total)}</td><td>{o.fulfillment}</td><td>{o.status}</td><td>{o.payment_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="admin-h3">✉️ Website forms — total submissions</h3>
      <div className="stat-grid">
        <StatCard label="Sell a Car requests" value={sell.length} />
        <StatCard label="Car inquiries / contact / signups" value={inquiries.length} />
        <StatCard label="Flight bookings & estimations" value={flights.length} />
      </div>

      {topTags.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead><tr><th>Inquiries by type (car_inquiries tag)</th><th>Count</th></tr></thead>
            <tbody>
              {topTags.map(([tag, n]) => <tr key={tag}><td>{tag}</td><td>{n}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}

      <p className="hint">Details per area: Products & Stock to edit the store, Orders to manage sales, Form Submissions to read everything in full.</p>
    </div>
  )
}
