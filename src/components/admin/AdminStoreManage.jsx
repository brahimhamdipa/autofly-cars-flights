import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { loadProviders, loadCategories } from '../../lib/storeData'
import { Modal, PicField } from './StoreFormBits'
import { money } from '../../lib/storeData'

// Editing/Deleting section: one page per table. Pick a table, search it,
// then Edit (popup, prefilled) or Delete (confirm). A provider or category
// that still has items cannot be deleted until those items are gone first
// — the database refuses it, and the error is shown plainly.
const TABLES = [
  ['providers', 'Providers', 'store_providers'],
  ['items', 'Items', 'store_items'],
  ['categories', 'Categories', 'store_categories'],
]

export default function AdminStoreManage() {
  const [table, setTable] = useState('providers')
  const [rows, setRows] = useState(null)
  const [providers, setProviders] = useState([])
  const [categories, setCategories] = useState([])
  const [query, setQuery] = useState('')
  const [edit, setEdit] = useState(null)
  const [status, setStatus] = useState('')

  const tableName = TABLES.find(t => t[0] === table)[2]

  const reload = () => {
    setRows(null)
    let q = supabase.from(tableName).select('*').order('name')
    if (table === 'items') q = supabase.from(tableName).select('*, provider:store_providers(name), category:store_categories(name)').order('name')
    q.then(({ data, error }) => {
      if (error) { setStatus('Error: ' + error.message); setRows([]) }
      else setRows(data || [])
    })
    loadProviders().then(setProviders).catch(() => {})
    loadCategories().then(setCategories).catch(() => {})
  }

  useEffect(reload, [table])

  const filtered = useMemo(() => {
    if (!rows) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(needle))
  }, [rows, query])

  const remove = async (row) => {
    if (!window.confirm(`Delete "${row.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from(tableName).delete().eq('id', row.id)
    if (error) { setStatus('Cannot delete: ' + error.message + (table !== 'items' ? ' — delete or move its items first.' : '')); return }
    setStatus(`✓ Deleted "${row.name}".`)
    reload()
  }

  const saveEdit = async (e, draft) => {
    e.preventDefault()
    const { id, created_at, provider, category, ...fields } = draft
    if (fields.price !== undefined) fields.price = Number(fields.price)
    if (fields.stock !== undefined) fields.stock = fields.stock === '' || fields.stock === null ? null : Number(fields.stock)
    if (fields.provider_id !== undefined) fields.provider_id = Number(fields.provider_id)
    if (fields.category_id !== undefined) fields.category_id = Number(fields.category_id)
    if (table !== 'categories') fields.updated_at = new Date().toISOString()
    const { error } = await supabase.from(tableName).update(fields).eq('id', id)
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Saved "${draft.name}".`)
    setEdit(null)
    reload()
  }

  return (
    <div>
      <div className="hero-card">
        <h2>✏️ Edit or delete store tables</h2>
        <div className="trip-tabs">
          {TABLES.map(([key, label]) => (
            <button key={key} type="button" className={table === key ? 'active' : ''} onClick={() => setTable(key)}>{label}</button>
          ))}
        </div>
        <div className="filters">
          <input placeholder="Search this table..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {status && <p className="hint">{status}</p>}
      </div>

      <div className="hero-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>Name</th>
              {table === 'items' && <><th>Price</th><th>Provider</th><th>Category</th><th>Delivery</th><th>Pickup</th><th>Shown</th><th>Online</th><th>Stock</th></>}
              {table === 'providers' && <><th>City</th><th>Country</th><th>Photos</th></>}
              {table === 'categories' && <th>Link name</th>}
              <th>Edit</th><th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.name}</td>
                {table === 'items' && (
                  <>
                    <td>{money(r.price)}</td>
                    <td>{r.provider?.name || r.provider_id}</td>
                    <td>{r.category?.name || r.category_id}</td>
                    <td>{r.delivery ? 'Yes' : 'No'}</td>
                    <td>{r.pickup ? 'Yes' : 'No'}</td>
                    <td>{r.is_active ? 'Yes' : 'Hidden'}</td>
                    <td>{r.online ? 'Yes' : 'No'}</td>
                    <td>{r.stock === null || r.stock === undefined ? '—' : r.stock}</td>
                  </>
                )}
                {table === 'providers' && <><td>{r.city}</td><td>{r.country}</td><td>{(r.pics || []).length}</td></>}
                {table === 'categories' && <td>{r.slug}</td>}
                <td><button type="button" className="btn-mini" onClick={() => setEdit({ ...r })}>Edit</button></td>
                <td><button type="button" className="btn-mini" onClick={() => remove(r)}>Delete</button></td>
              </tr>
            ))}
            {rows && filtered.length === 0 && <tr><td colSpan="10">Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>

      {edit && table === 'providers' && (
        <Modal title={`Edit provider — ${edit.name}`} onClose={() => setEdit(null)}>
          <form onSubmit={e => saveEdit(e, edit)} className="modal-form">
            <input required placeholder="Store name" value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })} />
            <input placeholder="Phone" value={edit.phone || ''} onChange={e => setEdit({ ...edit, phone: e.target.value })} />
            <input placeholder="Email" value={edit.email || ''} onChange={e => setEdit({ ...edit, email: e.target.value })} />
            <input placeholder="Address" value={edit.address || ''} onChange={e => setEdit({ ...edit, address: e.target.value })} />
            <input placeholder="City" value={edit.city || ''} onChange={e => setEdit({ ...edit, city: e.target.value })} />
            <input placeholder="Country" value={edit.country || ''} onChange={e => setEdit({ ...edit, country: e.target.value })} />
            <input placeholder="Zip code" value={edit.zip || ''} onChange={e => setEdit({ ...edit, zip: e.target.value })} />
            <input placeholder="Hours" value={edit.hours || ''} onChange={e => setEdit({ ...edit, hours: e.target.value })} />
            <textarea placeholder="About the store" value={edit.about || ''} onChange={e => setEdit({ ...edit, about: e.target.value })} />
            <PicField pics={edit.pics || []} setPics={pics => setEdit({ ...edit, pics })} />
            <button type="submit">Save changes</button>
          </form>
        </Modal>
      )}

      {edit && table === 'items' && (
        <Modal title={`Edit item — ${edit.name}`} onClose={() => setEdit(null)}>
          <form onSubmit={e => saveEdit(e, edit)} className="modal-form">
            <select required value={edit.provider_id} onChange={e => setEdit({ ...edit, provider_id: e.target.value })}>
              {providers.map(pr => <option key={pr.id} value={pr.id}>{pr.name}</option>)}
            </select>
            <select required value={edit.category_id} onChange={e => setEdit({ ...edit, category_id: e.target.value })}>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <input required placeholder="Item name" value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })} />
            <input required placeholder="Price" type="number" step="0.01" min="0" value={edit.price ?? ''} onChange={e => setEdit({ ...edit, price: e.target.value })} />
            <textarea placeholder="Description" value={edit.description || ''} onChange={e => setEdit({ ...edit, description: e.target.value })} />
            <input placeholder="Delivery address" value={edit.delivery_address || ''} onChange={e => setEdit({ ...edit, delivery_address: e.target.value })} />
            <input placeholder="Pickup address" value={edit.pickup_address || ''} onChange={e => setEdit({ ...edit, pickup_address: e.target.value })} />
            <label><input type="checkbox" checked={!!edit.delivery} onChange={e => setEdit({ ...edit, delivery: e.target.checked })} /> Delivery available</label>
            <label><input type="checkbox" checked={!!edit.pickup} onChange={e => setEdit({ ...edit, pickup: e.target.checked })} /> Pickup available</label>
            <label><input type="checkbox" checked={!!edit.is_active} onChange={e => setEdit({ ...edit, is_active: e.target.checked })} /> Show this item on the site</label>
            <label><input type="checkbox" checked={!!edit.online} onChange={e => setEdit({ ...edit, online: e.target.checked })} /> Sell this item on the Online Store page</label>
            <input placeholder="Stock (empty = not tracked)" type="number" min="0" value={edit.stock ?? ''} onChange={e => setEdit({ ...edit, stock: e.target.value })} />
            <PicField pics={edit.pics || []} setPics={pics => setEdit({ ...edit, pics })} />
            <button type="submit">Save changes</button>
          </form>
        </Modal>
      )}

      {edit && table === 'categories' && (
        <Modal title={`Edit category — ${edit.name}`} onClose={() => setEdit(null)}>
          <form onSubmit={e => saveEdit(e, edit)} className="modal-form">
            <input required placeholder="Category name" value={edit.name || ''} onChange={e => setEdit({ ...edit, name: e.target.value })} />
            <p className="hint">Link name stays "{edit.slug}" — renaming here does not change existing links.</p>
            <button type="submit">Save changes</button>
          </form>
        </Modal>
      )}
    </div>
  )
}
