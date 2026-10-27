import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import { loadProviders, loadCategories } from '../../lib/storeData'
import { ProviderForm, ItemForm, CategoryForm, ProviderFormEditor } from './StoreFormBits'
import { money } from '../../lib/storeData'

// Editing/Deleting section: one page per table, same pattern as the
// Products & Stock page — a form above the table (blank for a new row,
// filled when Edit is tapped) and Edit/Delete on every row. No popups.
// A provider or category that still has items cannot be deleted until
// those items are gone first — the database refuses it, and the error
// is shown plainly.
const TABLES = [
  ['providers', 'Providers', 'store_providers'],
  ['items', 'Items', 'store_items'],
  ['categories', 'Categories', 'store_categories'],
  ['forms', 'Provider Forms', 'providersForm'],
]
const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const blankDraft = (table) => {
  if (table === 'providers') return { name: '', phone: '', email: '', address: '', city: '', country: '', zip: '', hours: '', about: '', pics: [], holdorder: false, payorder: true }
  if (table === 'items') return { provider_id: '', category_id: '', name: '', price: '', description: '', delivery_address: '', pickup_address: '', delivery: true, pickup: true, is_active: true, online: false, stock: '', pics: [] }
  if (table === 'forms') return { provider_id: '', f: '', u: '', p: '', comment: '' }
  return { name: '' }
}

export default function AdminStoreManage() {
  const [table, setTable] = useState('providers')
  const [rows, setRows] = useState(null)
  const [providers, setProviders] = useState([])
  const [categories, setCategories] = useState([])
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState(() => blankDraft('providers'))
  const [status, setStatus] = useState('')

  const tableName = TABLES.find(t => t[0] === table)[2]

  const reload = () => {
    setRows(null)
    let q = supabase.from(tableName).select('*').order('name')
    if (table === 'items') q = supabase.from(tableName).select('*, provider:store_providers(name), category:store_categories(name)').order('name')
    if (table === 'forms') q = supabase.from(tableName).select('*').order('f')
    q.then(({ data, error }) => {
      if (error) { setStatus('Error: ' + error.message); setRows([]) }
      else setRows(data || [])
    })
    loadProviders().then(setProviders).catch(() => {})
    loadCategories().then(setCategories).catch(() => {})
  }

  useEffect(reload, [table])

  const pickTable = (key) => {
    setTable(key)
    setDraft(blankDraft(key))
    setStatus('')
  }

  const filtered = useMemo(() => {
    if (!rows) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(needle))
  }, [rows, query])

  const remove = async (row) => {
    const label = table === 'forms' ? row.f : row.name
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return
    const { error } = await supabase.from(tableName).delete().eq('id', row.id)
    if (error) { setStatus('Cannot delete: ' + error.message + (table === 'providers' || table === 'categories' ? ' — delete or move its items first.' : '')); return }
    setStatus(`✓ Deleted "${label}".`)
    reload()
  }

  const save = async (e) => {
    e.preventDefault()
    const { id, created_at, provider, category, ...fields } = draft
    if (fields.price !== undefined) fields.price = Number(fields.price)
    if (fields.stock !== undefined) fields.stock = fields.stock === '' || fields.stock === null ? null : Number(fields.stock)
    if (fields.provider_id !== undefined) fields.provider_id = Number(fields.provider_id)
    if (fields.category_id !== undefined) fields.category_id = Number(fields.category_id)
    if (table === 'categories' && !id) fields.slug = slugify(fields.name)
    if (table !== 'categories' && id) fields.updated_at = new Date().toISOString()
    if (table === 'providers') {
      fields.holdorder = !!fields.holdorder
      fields.payorder = fields.payorder !== false
    }
    if (table === 'forms') {
      fields.f = slugify(fields.f || '')
      if (!fields.f) { setStatus('Error: the form name has to contain a letter or number.'); return }
      if (fields.f === 'admin') { setStatus('Error: "admin" is reserved — pick another form name.'); return }
    }
    const q = id
      ? supabase.from(tableName).update(fields).eq('id', id)
      : supabase.from(tableName).insert(fields)
    const { error } = await q
    if (error) { setStatus('Error: ' + error.message); return }
    setStatus(`✓ Saved "${draft.name}".`)
    setDraft(blankDraft(table))
    reload()
  }

  const kindLabel = table === 'providers' ? 'provider' : table === 'items' ? 'item' : table === 'forms' ? 'provider form' : 'category'
  const formTitle = draft.id ? `Edit ${kindLabel} — ${table === 'forms' ? draft.f : draft.name}` : `New ${kindLabel}`
  const submitLabel = draft.id ? 'Save changes' : `Save ${kindLabel}`

  return (
    <div>
      <div className="hero-card">
        <h2>✏️ Edit or delete store tables</h2>
        <div className="trip-tabs">
          {TABLES.map(([key, label]) => (
            <button key={key} type="button" className={table === key ? 'active' : ''} onClick={() => pickTable(key)}>{label}</button>
          ))}
        </div>
        <div className="filters">
          <input placeholder="Search this table..." value={query} onChange={e => setQuery(e.target.value)} />
        </div>
        {status && <p className="hint">{status}</p>}
      </div>

      <h3>{formTitle}</h3>
      {table === 'providers' && (
        <ProviderForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'items' && (
        <ItemForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} providers={providers} categories={categories} />
      )}
      {table === 'categories' && (
        <CategoryForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'forms' && (
        <ProviderFormEditor draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} providers={providers}
          takenProviderIds={(rows || []).filter(r => r.id !== draft.id).map(r => r.provider_id)} />
      )}

      <div className="hero-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>{table === 'forms' ? 'Store' : 'Name'}</th>
              {table === 'items' && <><th>Price</th><th>Provider</th><th>Category</th><th>Delivery</th><th>Pickup</th><th>Shown</th><th>Online</th><th>Stock</th></>}
              {table === 'providers' && <><th>City</th><th>Country</th><th>Photos</th><th>Hold orders</th><th>Pay orders</th></>}
              {table === 'categories' && <th>Link name</th>}
              {table === 'forms' && <><th>Form address</th><th>Username</th><th>Comment</th></>}
              <th>Edit</th><th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{table === 'forms' ? (providers.find(pr => pr.id === r.provider_id)?.name || r.provider_id) : r.name}</td>
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
                {table === 'providers' && <><td>{r.city}</td><td>{r.country}</td><td>{(r.pics || []).length}</td><td>{r.holdorder ? 'Yes' : 'No'}</td><td>{r.payorder !== false ? 'Yes' : 'No'}</td></>}
                {table === 'categories' && <td>{r.slug}</td>}
                {table === 'forms' && <><td><a href={`/${r.f}`} target="_blank" rel="noreferrer">autofly.us.com/{r.f}</a></td><td>{r.u}</td><td>{r.comment}</td></>}
                <td><button type="button" className="btn-mini" onClick={() => setDraft({ ...r })}>Edit</button></td>
                <td><button type="button" className="btn-mini" onClick={() => remove(r)}>Delete</button></td>
              </tr>
            ))}
            {rows && filtered.length === 0 && <tr><td colSpan="12">Nothing here yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
