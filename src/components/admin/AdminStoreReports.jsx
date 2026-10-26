import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { money } from '../../lib/storeData'

// Reports section: links in a row, each opening a searchable report
// table, with a "To PDF" button (print → Save as PDF, same as the rest
// of the admin area).
const REPORTS = [
  ['providers', 'All Providers'],
  ['items', 'All Items'],
  ['items-providers', 'Items → Providers'],
  ['providers-items', 'Providers → Items'],
  ['orders', 'Orders'],
  ['holds', 'Holds'],
]

export default function AdminStoreReports() {
  const [report, setReport] = useState('providers')
  const [rows, setRows] = useState(null)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    setRows(null); setError('')
    const run = async () => {
      try {
        if (report === 'providers') {
          const { data, error } = await supabase.from('store_providers').select('*').order('name')
          if (error) throw error
          setRows(data || [])
        } else if (report === 'items' || report === 'items-providers') {
          const { data, error } = await supabase.from('store_items')
            .select('*, provider:store_providers(name, phone, country, city), category:store_categories(name)')
            .order('name')
          if (error) throw error
          setRows(data || [])
        } else if (report === 'providers-items') {
          const { data, error } = await supabase.from('store_providers').select('*, items:store_items(id, name, price, is_active)').order('name')
          if (error) throw error
          setRows(data || [])
        } else if (report === 'orders') {
          const { data, error } = await supabase.from('store_orders').select('*, provider:store_providers(name)').order('created_at', { ascending: false })
          if (error) throw error
          setRows(data || [])
        } else if (report === 'holds') {
          const { data, error } = await supabase.from('store_holds').select('*, item:store_items(name, price), provider:store_providers(name)').order('created_at', { ascending: false })
          if (error) throw error
          setRows(data || [])
        }
      } catch (e) {
        setError(e.message)
        setRows([])
      }
    }
    run()
  }, [report])

  const filtered = useMemo(() => {
    if (!rows) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(needle))
  }, [rows, query])

  return (
    <div>
      <div className="hero-card no-print">
        <h2>📄 Store reports</h2>
        <p>Pick a report, search while typing, then "To PDF" for a clean printable copy.</p>
        <div className="report-links">
          {REPORTS.map(([key, label]) => (
            <button key={key} type="button" className={report === key ? 'active' : ''} onClick={() => setReport(key)}>{label}</button>
          ))}
        </div>
        <div className="filters">
          <input placeholder="Search this report (filters as you type)..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        <div className="store-actions">
          <button type="button" onClick={() => window.print()}>📄 To PDF</button>
        </div>
        <p className="hint">On iPhone: Print → pinch out / share → Save to Files as PDF.</p>
      </div>

      <div className="hero-card">
        {error && <p>Couldn't load this report: {error}</p>}
        {!error && rows === null && <p>Loading report...</p>}
        {!error && rows && filtered.length === 0 && <p>No rows match.</p>}
        {!error && rows && filtered.length > 0 && (
          <table className="admin-table">
            <thead>
              <tr>
                {report === 'providers' && <><th>ID</th><th>Name</th><th>Phone</th><th>City</th><th>Country</th><th>Photos</th></>}
                {(report === 'items' || report === 'items-providers') && <><th>ID</th><th>Item</th><th>Price</th><th>Category</th><th>Provider</th><th>Delivery</th><th>Pickup</th><th>Shown</th><th>Online</th><th>Stock</th></>}
                {report === 'providers-items' && <><th>ID</th><th>Provider</th><th>Country</th><th>Items</th></>}
                {report === 'orders' && <><th>ID</th><th>Store</th><th>Customer</th><th>Fulfillment</th><th>Total</th><th>Status</th><th>Date</th></>}
                {report === 'holds' && <><th>ID</th><th>Item</th><th>Store</th><th>Customer</th><th>Status</th><th>Date</th></>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  {report === 'providers' && <><td>{r.id}</td><td>{r.name}</td><td>{r.phone}</td><td>{r.city}</td><td>{r.country}</td><td>{(r.pics || []).length}</td></>}
                  {(report === 'items' || report === 'items-providers') && (
                    <><td>{r.id}</td><td>{r.name}</td><td>{money(r.price)}</td><td>{r.category?.name}</td>
                    <td>{report === 'items-providers' ? `${r.provider?.name || ''}${r.provider?.phone ? ` (${r.provider.phone})` : ''}` : (r.provider?.name || r.provider_id)}</td>
                    <td>{r.delivery ? 'Yes' : 'No'}</td><td>{r.pickup ? 'Yes' : 'No'}</td><td>{r.is_active ? 'Yes' : 'Hidden'}</td>
                    <td>{r.online ? 'Yes' : 'No'}</td><td>{r.stock === null || r.stock === undefined ? '—' : r.stock}</td></>
                  )}
                  {report === 'providers-items' && (
                    <><td>{r.id}</td><td>{r.name}</td><td>{r.country}</td>
                    <td>{(r.items || []).map(i => `${i.name} (${money(i.price)})`).join(', ') || '— no items —'}</td></>
                  )}
                  {report === 'orders' && (
                    <><td>{r.id}</td><td>{r.provider?.name}</td><td>{r.customer_name} ({r.customer_email})</td>
                    <td>{r.fulfillment}</td><td>{money(r.total)}</td><td>{r.status}</td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td></>
                  )}
                  {report === 'holds' && (
                    <><td>{r.id}</td><td>{r.item?.name}</td><td>{r.provider?.name}</td>
                    <td>{r.customer_name} ({r.customer_email})</td><td>{r.status}</td>
                    <td>{new Date(r.created_at).toLocaleDateString()}</td></>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
