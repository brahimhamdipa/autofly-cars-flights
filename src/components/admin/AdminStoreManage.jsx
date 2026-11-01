import { useEffect, useMemo, useRef, useState } from 'react'

import { supabase } from '../../lib/supabaseClient'

import { loadProviders, syncItemLinks, loadItemCategories, loadFromDel, loadToPick } from '../../lib/storeData'

import { ProviderForm, ItemForm, ProviderFormEditor, FromDelForm, ToPickForm, ItemCategoryForm, SubCategoryForm } from './StoreFormBits'

import { money } from '../../lib/storeData'

// Editing/Deleting section: one page per table, same pattern as the
// Products & Stock page — a form above the table (blank for a new row,
// filled when Edit is tapped) and Edit/Delete on every row. No popups.
// A provider that still has items cannot be deleted until those items
// are gone first — the database refuses it, and the error is shown
// plainly. Categories live ONLY in the new category table ("Item
// Categories" tab) and link to items via tick boxes on the Items form;
// the old store_categories table is gone.
const TABLES = [
  ['providers', 'Providers', 'store_providers'],
  ['items', 'Items', 'store_items'],
  ['forms', 'Provider Forms', 'providersForm'],
  ['fromdel', 'Delivery Locations', 'fromDel'],
  ['topick', 'Pickup Locations', 'toPick'],
  ['itemcats', 'Item Categories', 'category'],
  ['subcats', 'Sub Categories', 'subCategory'],
]

const slugify = (s) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

const blankDraft = (table) => {
  if (table === 'providers') return { name: '', phone: '', email: '', address: '', city: '', country: '', zip: '', hours: '', about: '', pics: [], holdorder: false, payorder: true }
  if (table === 'items') return { provider_id: '', name: '', price: '', description: '', delivery_address: '', pickup_address: '', delivery: true, pickup: true, is_active: true, stock: '', pics: [] }
  if (table === 'forms') return { provider_id: '', f: '', u: '', p: '', comment: '' }
  if (table === 'fromdel') return { fname: '', faddress: '', fcity: '', fstate: '', fzip: '', fcountry: '', fcounty: '', ftownship: '', fcomment: '' }
  if (table === 'topick') return { tname: '', taddress: '', tcity: '', tstate: '', tzip: '', tcountry: '', tcounty: '', ttownship: '', tcomment: '' }
  if (table === 'itemcats') return { label: '' }
  if (table === 'subcats') return { category_id: '', flavor: '', color: '', packof: '', size: '', weight: '', unit: '' }
  return { name: '' }
}

export default function AdminStoreManage() {

  const [table, setTable] = useState('providers')

  const [rows, setRows] = useState(null)

  const [providers, setProviders] = useState([])

  // Lists the Items form links against (new category table, locations).
  const [itemCategories, setItemCategories] = useState([])

  const [fromdel, setFromdel] = useState([])

  const [topick, setTopick] = useState([])

  const [query, setQuery] = useState('')

  const [draft, setDraft] = useState(() => blankDraft('providers'))

  const [status, setStatus] = useState('')

  const [menuOpen, setMenuOpen] = useState(false)

  const menuRef = useRef(null)

  const tableName = TABLES.find(t => t[0] === table)[2]

  const tableLabel = TABLES.find(t => t[0] === table)[1]

  const reload = () => {
    setRows(null)
    let q = supabase.from(tableName).select('*').order('name')
    if (table === 'items') q = supabase.from(tableName).select('*, provider:store_providers(name)').order('pending_approval', { ascending: false }).order('name')
    if (table === 'forms') q = supabase.from(tableName).select('*').order('f')
    if (table === 'fromdel') q = supabase.from(tableName).select('*').order('fname')
    if (table === 'topick') q = supabase.from(tableName).select('*').order('tname')
    if (table === 'itemcats') q = supabase.from(tableName).select('*').order('label')
    if (table === 'subcats') q = supabase.from(tableName).select('*').order('id')
    q.then(({ data, error }) => {
      if (error) { setStatus('Error: ' + error.message); setRows([]) }
      else setRows(data || [])
    })
    loadProviders().then(setProviders).catch(() => {})
    loadItemCategories().then(setItemCategories).catch(() => {})
    loadFromDel().then(setFromdel).catch(() => {})
    loadToPick().then(setTopick).catch(() => {})
  }

  useEffect(reload, [table])

  // Outside tap closes the table submenu (same pattern as the website menus).
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false) }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [menuOpen])

  const pickTable = (key) => {
    setTable(key)
    setDraft(blankDraft(key))
    setStatus('')
    setMenuOpen(false)
  }

  const filtered = useMemo(() => {
    if (!rows) return []
    const needle = query.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(r => JSON.stringify(r).toLowerCase().includes(needle))
  }, [rows, query])

  // One label per row, used by the Name cell and the delete confirm.
  const rowLabel = (r) => table === 'forms' ? r.f : table === 'fromdel' ? r.fname : table === 'topick' ? r.tname : table === 'itemcats' ? r.label : table === 'subcats' ? (r.flavor || r.color || ('Sub #' + r.id)) : r.name

  const remove = async (row) => {
    const label = rowLabel(row)
    if (!window.confirm(`Delete "${label}"? This cannot be undone.`)) return
    const { error } = await supabase.from(tableName).delete().eq('id', row.id)
    if (error) { setStatus('Cannot delete: ' + error.message + (table === 'providers' ? ' — delete or move its items first.' : '')); return }
    setStatus(`✓ Deleted "${label}".`)
    reload()
  }

  // Approval step: a pending provider item goes live with one tap.
  const approve = async (row) => {
    const { error } = await supabase.from('store_items').update({ is_active: true, pending_approval: false }).eq('id', row.id)
    if (error) { setStatus('Cannot approve: ' + error.message); return }
    setStatus(`✓ Approved "${row.name}" — now live.`)
    reload()
  }

  // Items Edit loads the item's current links, so the tick boxes in
  // the form show what is already linked. Other tables edit as before.
  const editItem = async (r) => {
    const [cats, fds, tps] = await Promise.all([
      supabase.from('store_item_categories').select('category_id').eq('item_id', r.id),
      supabase.from('store_item_fromdel').select('fromdel_id').eq('item_id', r.id),
      supabase.from('store_item_topick').select('topick_id').eq('item_id', r.id),
    ])
    setDraft({
      ...r,
      _catIds: (cats.data || []).map(x => x.category_id),
      _fromIds: (fds.data || []).map(x => x.fromdel_id),
      _toIds: (tps.data || []).map(x => x.topick_id),
    })
  }

  const onToggle = (kind, id) => {
    const key = kind === 'cat' ? '_catIds' : kind === 'from' ? '_fromIds' : '_toIds'
    const cur = draft[key] || []
    setDraft({ ...draft, [key]: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] })
  }

  const save = async (e) => {
    e.preventDefault()
    const { id, created_at, provider, _catIds, _fromIds, _toIds, ...fields } = draft
    if (fields.price !== undefined) fields.price = Number(fields.price)
    if (fields.stock !== undefined) fields.stock = fields.stock === '' || fields.stock === null ? null : Number(fields.stock)
    if (fields.provider_id !== undefined) fields.provider_id = Number(fields.provider_id)
    if (fields.packof !== undefined) fields.packof = fields.packof === '' || fields.packof === null ? null : Number(fields.packof)
    if (fields.weight !== undefined) fields.weight = fields.weight === '' || fields.weight === null ? null : Number(fields.weight)
    if (table === 'itemcats' && !id) fields.slug = slugify(fields.label)
    // Only providers/items/forms carry updated_at; the new location /
    // category tables have created_at only, so stamping them would fail.
    if ((table === 'providers' || table === 'items' || table === 'forms') && id) fields.updated_at = new Date().toISOString()
    if (table === 'providers') {
      fields.holdorder = !!fields.holdorder
      fields.payorder = fields.payorder !== false
    }
    if (table === 'forms') {
      fields.f = slugify(fields.f || '')
      if (!fields.f) { setStatus('Error: the form name has to contain a letter or number.'); return }
      if (fields.f === 'admin') { setStatus('Error: "admin" is reserved — pick another form name.'); return }
    }
    if (table === 'items') {
      const q = id
        ? supabase.from(tableName).update(fields).eq('id', id)
        : supabase.from(tableName).insert(fields).select('id').single()
      const { data, error } = await q
      if (error) { setStatus('Error: ' + error.message); return }
      const savedId = id || data?.id
      try {
        await syncItemLinks(savedId, { categoryIds: draft._catIds || [], fromdelIds: draft._fromIds || [], topickIds: draft._toIds || [] })
      } catch (linkErr) {
        setStatus(`✓ Saved "${rowLabel(draft)}" but links failed: ${linkErr.message}`)
        setDraft(blankDraft(table))
        reload()
        return
      }
    } else {
      const q = id
        ? supabase.from(tableName).update(fields).eq('id', id)
        : supabase.from(tableName).insert(fields)
      const { error } = await q
      if (error) { setStatus('Error: ' + error.message); return }
    }
    setStatus(`✓ Saved "${rowLabel(draft)}".`)
    setDraft(blankDraft(table))
    reload()
  }

  const kindLabel = table === 'providers' ? 'provider' : table === 'items' ? 'item' : table === 'forms' ? 'provider form' : table === 'fromdel' ? 'delivery location' : table === 'topick' ? 'pickup location' : table === 'itemcats' ? 'item category' : table === 'subcats' ? 'sub category' : 'row'

  const formTitle = draft.id ? `Edit ${kindLabel} — ${rowLabel(draft)}` : `New ${kindLabel}`

  const submitLabel = draft.id ? 'Save changes' : `Save ${kindLabel}`

  return (
    <div>
      <div className="hero-card">
        <h2>✏️ Edit or delete store tables</h2>
        <div className="car-submenu-wrap" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen(o => !o)} aria-haspopup="true" aria-expanded={menuOpen}>{tableLabel} ▾</button>
          {menuOpen && (
            <div className="car-submenu">
              {TABLES.map(([key, label]) => (
                <button key={key} type="button" onClick={() => pickTable(key)}>{label}</button>
              ))}
            </div>
          )}
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
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} providers={providers}
          linkData={{ itemCategories, fromdel, topick, selected: { categoryIds: draft._catIds || [], fromdelIds: draft._fromIds || [], topickIds: draft._toIds || [] }, onToggle }} />
      )}
      {table === 'forms' && (
        <ProviderFormEditor draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} providers={providers}
          takenProviderIds={(rows || []).filter(r => r.id !== draft.id).map(r => r.provider_id)} />
      )}
      {table === 'fromdel' && (
        <FromDelForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'topick' && (
        <ToPickForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'itemcats' && (
        <ItemCategoryForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} />
      )}
      {table === 'subcats' && (
        <SubCategoryForm draft={draft} setDraft={setDraft} onSubmit={save} submitLabel={submitLabel}
          onCancel={draft.id ? () => setDraft(blankDraft(table)) : null} itemCategories={itemCategories} />
      )}

      <div className="hero-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>{table === 'forms' ? 'Store' : 'Name'}</th>
              {table === 'items' &&
                <><th>Price</th><th>Provider</th><th>Delivery</th><th>Pickup</th><th>Shown</th><th>Stock</th></>}
              {table === 'providers' && <><th>City</th><th>Country</th><th>Photos</th><th>Hold orders</th><th>Pay orders</th></>}
              {table === 'forms' && <><th>Form address</th><th>Username</th><th>Comment</th></>}
              {table === 'fromdel' && <><th>Address</th><th>City</th><th>State</th><th>Zip</th><th>Country</th></>}
              {table === 'topick' && <><th>Address</th><th>City</th><th>State</th><th>Zip</th><th>Country</th></>}
              {table === 'itemcats' && <th>Slug</th>}
              {table === 'subcats' && <><th>Category</th><th>Flavor</th><th>Color</th><th>Pack</th><th>Size</th><th>Weight</th><th>Unit</th></>}
              <th>Edit</th><th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(r => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{table === 'forms' ? (providers.find(pr => pr.id === r.provider_id)?.name || r.provider_id) : rowLabel(r)}</td>
                {table === 'items' && (
                  <>
                    <td>{money(r.price)}</td>
                    <td>{r.provider?.name || r.provider_id}</td>
                    <td>{r.delivery ? 'Yes' : 'No'}</td>
                    <td>{r.pickup ? 'Yes' : 'No'}</td>
                    <td>{r.pending_approval ? 'Pending' : r.is_active ? 'Yes' : 'Hidden'}</td>
                    <td>{r.stock === null || r.stock === undefined ? '—' : r.stock}</td>
                  </>
                )}
                {table === 'providers' && <><td>{r.city}</td><td>{r.country}</td><td>{(r.pics || []).length}</td><td>{r.holdorder ? 'Yes' : 'No'}</td><td>{r.payorder !== false ? 'Yes' : 'No'}</td></>}
                {table === 'forms' && <><td><a href={`/${r.f}`} target="_blank" rel="noreferrer">autofly.us.com/{r.f}</a></td><td>{r.u}</td><td>{r.comment}</td></>}
                {table === 'fromdel' && <><td>{r.faddress}</td><td>{r.fcity}</td><td>{r.fstate}</td><td>{r.fzip}</td><td>{r.fcountry}</td></>}
                {table === 'topick' && <><td>{r.taddress}</td><td>{r.tcity}</td><td>{r.tstate}</td><td>{r.tzip}</td><td>{r.tcountry}</td></>}
                {table === 'itemcats' && <td>{r.slug}</td>}
                {table === 'subcats' && <><td>{itemCategories.find(c => c.id === r.category_id)?.label || r.category_id}</td><td>{r.flavor}</td><td>{r.color}</td><td>{r.packof ?? '—'}</td><td>{r.size}</td><td>{r.weight ?? '—'}</td><td>{r.unit}</td></>}
                <td>
                  {table === 'items' && r.pending_approval && <button type="button" className="btn-mini" onClick={() => approve(r)}>Approve</button>}{' '}
                  <button type="button" className="btn-mini" onClick={() => table === 'items' ? editItem(r) : setDraft({ ...r })}>Edit</button>
                </td>
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
