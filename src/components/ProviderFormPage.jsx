import { useEffect, useState } from 'react'

import { supabase, NOTIFY_EMAIL } from '../lib/supabaseClient'

import { loadItemCategories, loadSubCategories, formatVariant } from '../lib/storeData'
import { loadBarberDomain } from '../lib/barberData'
import BarberTemplatePage from './BarberTemplatePage'

import { PicField } from './admin/StoreFormBits'
import EmployeeChatView from './EmployeeChatView'
import UploadFormPage from './UploadFormPage'

// Public provider form page, reached at autofly.us.com/<form name>.
// The store owner logs in with the username and password the admin
// gave them (checked server-side — the form's row is never readable
// by visitors), then submits items one at a time: each submit inserts
// ONE row into store_items for that form's store, hidden and pending
// approval, and emails the owner. The form is temporary: when the admin
// deletes it, logins and submits stop working, but items already
// submitted stay. The store name is already filled in at the top (from
// the provider the admin picked when creating the form) — the owner
// never types it.
const blankItem = () => ({

  category_id: '', name: '', price: '', description: '',

  delivery_address: '', pickup_address: '',

  delivery: true, pickup: true, stock: '', pics: [], subcategoryIds: []

})

export default function ProviderFormPage({ slug, goBack, onAuthedChange, go }) {

  const [categories, setCategories] = useState([])
  const [subcats, setSubcats] = useState([])

  const [username, setUsername] = useState('')

  const [password, setPassword] = useState('')

  const [authed, setAuthed] = useState(null)

  const [loginError, setLoginError] = useState('')

  const [loggingIn, setLoggingIn] = useState(false)

  const [item, setItem] = useState(blankItem)

  // Bulk list (data.json approval): built one item at a time, kept in
  // this browser so the store can take its time, sent as one batch.
  const [bulkItem, setBulkItem] = useState(blankItem)
  const [batchItems, setBatchItems] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('autofly-batch-' + slug) || '[]')
      return Array.isArray(saved) ? saved : []
    } catch { return [] }
  })
  const [batchStatus, setBatchStatus] = useState('')
  const [batchBusy, setBatchBusy] = useState(false)

  // Barber template lookup: null = not a barber slug (normal login
  // flow), a row = render the public template page instead.
  const [barberDomain, setBarberDomain] = useState(null)
  const [uploadForm, setUploadForm] = useState(false)
  const [slugChecking, setSlugChecking] = useState(true)

  const [status, setStatus] = useState('')

  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    Promise.all([
      loadBarberDomain(slug).catch(() => null),
      supabase.rpc('upload_form_exists', { p_f: slug }).then(({ data }) => !!data).catch(() => false),
    ]).then(([d, isUpload]) => {
      setBarberDomain(d)
      setUploadForm(isUpload)
      // The template and upload pages need no categories — skip those
      // loads when this slug is one of them.
      if (!d && !isUpload) {
        loadItemCategories().then(setCategories).catch(() => {})
        loadSubCategories().then(setSubcats).catch(() => {})
      }
    }).finally(() => setSlugChecking(false))
  }, [slug])
  useEffect(() => {
    try { localStorage.setItem('autofly-batch-' + slug, JSON.stringify(batchItems)) } catch {}
  }, [batchItems, slug])
  useEffect(() => {
    if (onAuthedChange) onAuthedChange(!!authed)
  }, [authed])

  const login = async(e) => {
    e.preventDefault()
    setLoggingIn(true)
    setLoginError('')
    try {
      const { data, error} = await supabase.rpc('check_provider_form', { p_slug: slug, p_username: username, p_password: password})
      if (!error && data && data.ok) {
        setAuthed({ kind: 'provider', providerId: data.provider_id, providerName: data.provider_name})
        return
      }
    } catch { /* fall through to the employee check */ }
    try {
      const { data, error} = await supabase.rpc('check_employee_pass', { p_form: slug, p_username: username, p_password: password})
      if (error) throw error
      setAuthed({ kind: 'employee', creds: { form: slug, username, password}, employee: { firstName: data.firstName, lastName: data.lastName, jobTitle: data.jobTitle}})
    } catch {
      setLoginError('Wrong username or password for this form.')
    } finally {
      setLoggingIn(false)
    }
  }
  const submitItem = async (e) => {
    e.preventDefault()
    setSubmitting(true); setStatus('')
    const { data, error } = await supabase.rpc('submit_provider_item', {
      p_slug: slug, p_username: username, p_password: password,
      p_category_ids: [Number(item.category_id)],
      p_subcategory_ids: item.subcategoryIds || [],
      p_name: item.name,
      p_price: Number(item.price),
      p_description: item.description,
      p_delivery_address: item.delivery_address,
      p_pickup_address: item.pickup_address,
      p_delivery: item.delivery,
      p_pickup: item.pickup,
      p_stock: item.stock === '' ? null : Number(item.stock),
      p_pics: item.pics,
    })
    setSubmitting(false)
    if (error) {
      if (error.message.includes('Invalid form login')) {
        setAuthed(null)
        setLoginError('This form is no longer available — please contact Yently.')
      } else {
        setStatus('Error: ' + error.message)
      }
      return
    }
    setStatus(`✓ Item sent for approval (id ${data.item_id}). It will appear on the store once Yently approves it. Submit another one below, or close this page when you are done.`)
    setItem(blankItem())
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          to: NOTIFY_EMAIL,
          subject: `New provider item to approve — ${authed.providerName}`,
          table: 'store_items',
          record: { store: authed.providerName, status: 'Pending approval — approve in Admin → Stores → Manage → Items', ...item, item_id: data.item_id },
        },
      })
    } catch (err) {
      setStatus(s => s + ' (Note: the item is saved, but the owner email failed.)')
    }
  }
  const normalizeBulkItem = (it) => ({
    category_id: it.category_id === '' || it.category_id === null || it.category_id === undefined ? '' : Number(it.category_id),
    name: (it.name || '').trim(),
    price: Number(it.price),
    description: it.description || '',
    delivery_address: it.delivery_address || '',
    pickup_address: it.pickup_address || '',
    delivery: !!it.delivery,
    pickup: !!it.pickup,
    stock: it.stock === '' || it.stock === null || it.stock === undefined ? null : Number(it.stock),
    pics: it.pics || [],
    subcategoryIds: (it.subcategoryIds || []).map(Number),
  })

  const addBulkItem = (e) => {
    e.preventDefault()
    setBatchItems([...batchItems, normalizeBulkItem(bulkItem)])
    setBulkItem(blankItem())
    setBatchStatus(`Added — ${batchItems.length + 1} item${batchItems.length === 0 ? '' : 's'} in the list.`)
  }

  const downloadBatch = () => {
    const blob = new Blob([JSON.stringify(batchItems, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'data.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const loadBatchFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed)) throw new Error('The file must hold a list of items.')
      const items = parsed.map(normalizeBulkItem)
      for (const it of items) {
        if (!it.name) throw new Error('Every item in the file needs a name.')
        if (!(it.price >= 0)) throw new Error(`Item "${it.name}" needs a price.`)
      }
      setBatchItems(items)
      setBatchStatus(`Loaded ${items.length} item${items.length === 1 ? '' : 's'} from ${file.name} — this replaced the list.`)
    } catch (err) {
      setBatchStatus('Could not load that file: ' + err.message)
    }
    e.target.value = ''
  }

  const submitBatch = async () => {
    if (batchItems.length === 0) { setBatchStatus('Add at least one item first.'); return }
    setBatchBusy(true); setBatchStatus('Sending the list for approval...')
    const { data, error } = await supabase.rpc('submit_store_item_batch', {
      p_slug: slug, p_username: username, p_password: password, p_items: batchItems,
    })
    setBatchBusy(false)
    if (error) {
      if (error.message.includes('Invalid form login')) {
        setAuthed(null)
        setLoginError('This form is no longer available — please contact Yently.')
      } else {
        setBatchStatus('Error: ' + error.message)
      }
      return
    }
    setBatchItems([])
    setBatchStatus(`✓ Sent ${data.items} item${data.items === 1 ? '' : 's'} for approval (batch #${data.batch_id}). They will appear on the store once Yently approves them.`)
    try {
      await supabase.functions.invoke('send-notification', {
        body: {
          to: NOTIFY_EMAIL,
          subject: `Items batch for approval — ${authed.providerName}`,
          table: 'store_item_batches',
          record: { store: authed.providerName, items: data.items, batch_id: data.batch_id },
        },
      })
    } catch {
      setBatchStatus(s => s + ' (Note: the list is saved, but the owner email failed.)')
    }
  }

  if (slugChecking) {
    return (
      <div>
        <div className="hero-card">
          {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}
          <p>Loading…</p>
        </div>
      </div>
    )
  }
  if (barberDomain) {
    return <BarberTemplatePage domain={barberDomain} goBack={goBack} />
  }
  if (uploadForm) {
    return <UploadFormPage slug={slug} goBack={goBack} go={go} />
  }
  if (authed?.kind === 'employee') {
    return <EmployeeChatView creds={authed.creds} employee={authed.employee} goBack={goBack} />
  }
  return (
    <div>
      <div className="hero-card">
        {goBack && <button className="link-btn" onClick={goBack}>← Back</button>}
        <h2>📝 Provider form</h2>
        {authed
          ? <p>Add items for <b>{authed.providerName}</b> — each submit sends one item for approval; it appears on the store once Yently approves it.</p>
          : <p>Log in with the username and password Yently gave you for this form.</p>}
      </div>

      {!authed && (
        <form onSubmit={login} className="form-card">
          <input required placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          <input required placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          <button type="submit" disabled={loggingIn}>{loggingIn ? 'Opening...' : 'Open form'}</button>
          {loginError && <p className="status">{loginError}</p>}
        </form>
      )}

      {authed?.kind === 'provider' && (
        <form onSubmit={submitItem} className="form-card">
          <label>Store
            <input disabled value={authed.providerName} />
          </label>
          <select required value={item.category_id} onChange={e => setItem({ ...item, category_id: e.target.value, subcategoryIds: []})}>
            <option value="">— Category —</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {subcats.filter(s => s.category_id === Number(item.category_id)).map(s => (
          <label key={s.id} style={{ display: 'block'}}>
            <input
              type="checkbox"
              checked={(item.subcategoryIds || []).includes(s.id)}
              onChange={() => setItem(prev => ({...prev, subcategoryIds: (prev.subcategoryIds || []).includes(s.id)? prev.subcategoryIds.filter(x => x!== s.id): [...prev.subcategoryIds, s.id]}))}
              /> {formatVariant(s)}
          </label>
          ))}
          <input required placeholder="Item name" value={item.name} onChange={e => setItem({ ...item, name: e.target.value })} />
          <input required placeholder="Price" type="number" step="0.01" min="0" value={item.price} onChange={e => setItem({ ...item, price: e.target.value })} />
          <textarea placeholder="Description" value={item.description} onChange={e => setItem({ ...item, description: e.target.value })} />
          <input placeholder="Delivery address (where delivery comes from)" value={item.delivery_address} onChange={e => setItem({ ...item, delivery_address: e.target.value })} />
          <input placeholder="Pickup address (where to pick up)" value={item.pickup_address} onChange={e => setItem({ ...item, pickup_address: e.target.value })} />
          <label><input type="checkbox" checked={item.delivery} onChange={e => setItem({ ...item, delivery: e.target.checked })} /> Delivery available</label>
          <label><input type="checkbox" checked={item.pickup} onChange={e => setItem({ ...item, pickup: e.target.checked })} /> Pickup available</label>
          <input placeholder="Stock (how many available — leave empty if not tracked)" type="number" min="0" value={item.stock} onChange={e => setItem({ ...item, stock: e.target.value })} />
          <PicField pics={item.pics} setPics={pics => setItem({ ...item, pics })} />
          <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Submit item'}</button>
          {status && <p className="status">{status}</p>}
        </form>
      )}
      {authed?.kind === 'provider' && (
        <div className="form-card">
          <h3>Add items in bulk</h3>
          <p>Fill items one by one below — take your time, the list is kept in this browser. When you are done, download it as data.json to keep a copy, or send the whole list for approval at once.</p>
          <form onSubmit={addBulkItem}>
            <select required value={bulkItem.category_id} onChange={e => setBulkItem({ ...bulkItem, category_id: e.target.value, subcategoryIds: []})}>
              <option value="">— Category —</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            {subcats.filter(s => s.category_id === Number(bulkItem.category_id)).map(s => (
            <label key={s.id} style={{ display: 'block'}}>
              <input
                type="checkbox"
                checked={(bulkItem.subcategoryIds || []).includes(s.id)}
                onChange={() => setBulkItem(prev => ({...prev, subcategoryIds: (prev.subcategoryIds || []).includes(s.id)? prev.subcategoryIds.filter(x => x!== s.id): [...prev.subcategoryIds, s.id]}))}
                /> {formatVariant(s)}
            </label>
            ))}
            <input required placeholder="Item name" value={bulkItem.name} onChange={e => setBulkItem({ ...bulkItem, name: e.target.value })} />
            <input required placeholder="Price" type="number" step="0.01" min="0" value={bulkItem.price} onChange={e => setBulkItem({ ...bulkItem, price: e.target.value })} />
            <textarea placeholder="Description" value={bulkItem.description} onChange={e => setBulkItem({ ...bulkItem, description: e.target.value })} />
            <input placeholder="Delivery address (where delivery comes from)" value={bulkItem.delivery_address} onChange={e => setBulkItem({ ...bulkItem, delivery_address: e.target.value })} />
            <input placeholder="Pickup address (where to pick up)" value={bulkItem.pickup_address} onChange={e => setBulkItem({ ...bulkItem, pickup_address: e.target.value })} />
            <label><input type="checkbox" checked={bulkItem.delivery} onChange={e => setBulkItem({ ...bulkItem, delivery: e.target.checked })} /> Delivery available</label>
            <label><input type="checkbox" checked={bulkItem.pickup} onChange={e => setBulkItem({ ...bulkItem, pickup: e.target.checked })} /> Pickup available</label>
            <input placeholder="Stock (how many available — leave empty if not tracked)" type="number" min="0" value={bulkItem.stock} onChange={e => setBulkItem({ ...bulkItem, stock: e.target.value })} />
            <PicField pics={bulkItem.pics} setPics={pics => setBulkItem({ ...bulkItem, pics })} />
            <button type="submit">Add an Item</button>
          </form>
          {batchItems.length > 0 && (
            <div>
              <p><b>Items in this list ({batchItems.length}):</b></p>
              {batchItems.map((it, i) => (
                <p key={i}>{it.name} — ${it.price} <button type="button" className="btn-mini" onClick={() => setBatchItems(batchItems.filter((_, j) => j !== i))}>Remove</button></p>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            <button type="button" onClick={downloadBatch} disabled={batchItems.length === 0}>Download data.json</button>
            <label className="btn-soft" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 16px', borderRadius: 10, cursor: 'pointer' }}>
              Load a data.json file
              <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={loadBatchFile} />
            </label>
            <button type="button" onClick={submitBatch} disabled={batchBusy || batchItems.length === 0}>{batchBusy ? 'Sending...' : 'Upload for approval'}</button>
          </div>
          {batchStatus && <p className="status">{batchStatus}</p>}
        </div>
      )}
    </div>
  )

}
