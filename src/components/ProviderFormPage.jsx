import { useEffect, useRef, useState } from 'react'

import { supabase, NOTIFY_EMAIL } from '../lib/supabaseClient'

import { loadItemCategories, loadSubCategories, formatVariant } from '../lib/storeData'
import { loadBarberDomain } from '../lib/barberData'
import BarberTemplatePage from './BarberTemplatePage'

import { PicField } from './admin/StoreFormBits'
import EmployeeChatView from './EmployeeChatView'
import UploadFormPage from './UploadFormPage'

// Public provider form page, reached at yently.com/<form name>.
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

  delivery: true, pickup: true, stock: '', barCode: '', pics: [], subcategoryIds: []

})

// Plain, detailed explanations for every field — shown when the
// store taps the "?" next to a label, so nobody has to guess how to
// fill the form in.
const HELP = {
  username: 'The username Yently gave you for this form. It is the one in the email or message from Yently — type it exactly as it is written, small letters and all. It is not your email address.',
  password: 'The password Yently gave you for this form. Type it exactly as it is written — passwords care about big and small letters. If it does not work, check for an extra space at the end, or ask Yently to send it again.',
  store: 'This is already filled in for you — it is your store\'s name, from the form Yently made for you. You cannot change it here. If it shows the wrong store, stop and contact Yently.',
  category: 'Pick the group your item belongs to — for example Drinks, Food, or Clothes. This decides where the item shows in the shop, so customers can find it. If no group fits perfectly, pick the closest one and mention it in the description.',
  variants: 'Tick every version of this item that a customer can choose — for example sizes, flavours, or colours. Each tick becomes a choice the customer picks when they buy. If the item has no versions, leave all of them unticked.',
  name: 'The name customers will see in the shop. Keep it short and clear — what it is, and the size if it matters. For example: Fresh Orange Juice 1L, or Cotton T-Shirt — Blue, Large.',
  price: 'What one of these costs, in dollars. Type numbers only — for example 3.99. Do not type a $ sign. This is the price the customer pays.',
  description: 'A few words about the item — what it is made of, how big it is, what is inside, anything that helps a customer decide. You can leave it empty, but a short description sells better.',
  deliveryAddress: 'The address deliveries start from — your shop, your kitchen, or wherever you keep the item. Only needed if you deliver this item. If you do not deliver, leave it empty.',
  pickupAddress: 'The address where customers come to collect the item. Only needed if you offer pickup. If customers cannot pick it up, leave it empty.',
  delivery: 'Ticked means you deliver this item to the customer. Untick it if this item is pickup only.',
  pickup: 'Ticked means the customer can come and collect this item. Untick it if this item is delivery only.',
  stock: 'How many of this item you have right now. Leave it empty if you do not count stock — the item will always show as available. If you put a number, the item shows as out of stock when it reaches 0.',
  barcode: 'The barcode number printed on the product — the number under the black bars. Type it exactly as it is printed. Leave it empty if the product has no barcode. It shows on the item in the shop, so customers and staff can match the product to it.',
  pictures: 'Tap Upload pictures and pick photos from your phone or computer — you can pick more than one at once. The first picture is the main one customers see. Clear, bright photos sell better. Tap the ✕ next to a picture to remove it.',
  addBulk: 'Adds the item above to your list. It is not sent yet — it just joins the list below. Fill in the next item the same way.',
  batchList: 'Everything in the list so far. Tap Remove next to an item to take it out of the list.',
  download: 'Saves your list as a file (data.json) on your phone or computer — a copy to keep, or to send to someone else to finish.',
  loadFile: 'Loads a list from a data.json file — for example one you downloaded before, or one someone made for you. It replaces the list you have now.',
  uploadBatch: 'Sends the whole list to Yently for approval at once. The items show on your store once they are approved.',
}

// The "?" button next to a field label. Tap once to open the
// explanation under it, tap again — or tap anywhere else on the
// page — to close it. Only one help is open at a time: tapping
// another "?" closes this one first.
function Help({ text }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  return (
    <span className="help" ref={ref}>
      <button type="button" className="help-btn" aria-label="Help" onClick={() => setOpen(o => !o)}>?</button>
      {open && <span className="help-pop">{text}</span>}
    </span>
  )
}

// The item fields, shared by the single-item form and the bulk form
// so both stay identical. Defined at module level (not inside the
// page) so typing never loses focus or closes an open help.
// item/setItem are the form's own state and setter; storeName is the
// store this form belongs to (already filled in, never typed).
function ItemFields({ item, setItem, categories, subcats, storeName }) {
  const set = (patch) => setItem(prev => ({ ...prev, ...patch }))
  const visibleSubcats = subcats.filter(s => s.category_id === Number(item.category_id))
  return (
    <>
      <div className="field">
        <span className="field-label">Store <Help text={HELP.store} /></span>
        <input disabled value={storeName} />
      </div>
      <div className="field">
        <span className="field-label">Category <Help text={HELP.category} /></span>
        <select required value={item.category_id} onChange={e => set({ category_id: e.target.value, subcategoryIds: [] })}>
          <option value="">— Category —</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
      </div>
      <div className="field">
        <span className="field-label">Variants <Help text={HELP.variants} /></span>
        {visibleSubcats.length === 0
          ? <p className="hint" style={{ margin: 0 }}>Pick a category first — its versions show here to tick.</p>
          : visibleSubcats.map(s => (
            <label key={s.id} className="check">
              <input
                type="checkbox"
                checked={(item.subcategoryIds || []).includes(s.id)}
                onChange={() => setItem(prev => ({ ...prev, subcategoryIds: (prev.subcategoryIds || []).includes(s.id) ? prev.subcategoryIds.filter(x => x !== s.id) : [...prev.subcategoryIds, s.id] }))}
              /> {formatVariant(s)}
            </label>
          ))}
      </div>
      <div className="field">
        <span className="field-label">Item name <Help text={HELP.name} /></span>
        <input required placeholder="Item name" value={item.name} onChange={e => set({ name: e.target.value })} />
      </div>
      <div className="field">
        <span className="field-label">Price <Help text={HELP.price} /></span>
        <input required placeholder="Price" type="number" step="0.01" min="0" value={item.price} onChange={e => set({ price: e.target.value })} />
      </div>
      <div className="field">
        <span className="field-label">Description <Help text={HELP.description} /></span>
        <textarea placeholder="Description" value={item.description} onChange={e => set({ description: e.target.value })} />
      </div>
      <div className="field">
        <span className="field-label">Delivery address <Help text={HELP.deliveryAddress} /></span>
        <input placeholder="Delivery address (where delivery comes from)" value={item.delivery_address} onChange={e => set({ delivery_address: e.target.value })} />
      </div>
      <div className="field">
        <span className="field-label">Pickup address <Help text={HELP.pickupAddress} /></span>
        <input placeholder="Pickup address (where to pick up)" value={item.pickup_address} onChange={e => set({ pickup_address: e.target.value })} />
      </div>
      <div className="field-row">
        <label className="check"><input type="checkbox" checked={item.delivery} onChange={e => set({ delivery: e.target.checked })} /> Delivery available</label>
        <Help text={HELP.delivery} />
      </div>
      <div className="field-row">
        <label className="check"><input type="checkbox" checked={item.pickup} onChange={e => set({ pickup: e.target.checked })} /> Pickup available</label>
        <Help text={HELP.pickup} />
      </div>
      <div className="field">
        <span className="field-label">Stock <Help text={HELP.stock} /></span>
        <input placeholder="Stock (how many available — leave empty if not tracked)" type="number" min="0" value={item.stock} onChange={e => set({ stock: e.target.value })} />
      </div>
      <div className="field">
        <span className="field-label">Barcode <Help text={HELP.barcode} /></span>
        <input placeholder="Barcode (optional — the number under the bars)" value={item.barCode || ''} onChange={e => set({ barCode: e.target.value })} />
      </div>
      <div className="field">
        <span className="field-label">Pictures <Help text={HELP.pictures} /></span>
        <PicField pics={item.pics} setPics={pics => set({ pics })} />
      </div>
    </>
  )
}

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
    barCode: (it.barCode || '').trim(),
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
        <h2>🏪 Store Setup</h2>
        {authed
          ? <p>Add items for <b>{authed.providerName}</b> — each submit sends one item for approval; it appears on the store once Yently approves it.</p>
          : <p>Log in with the username and password Yently gave you for this form.</p>}
      </div>

      {!authed && (
        <form onSubmit={login} className="form-card">
          <div className="field">
            <span className="field-label">Username <Help text={HELP.username} /></span>
            <input required placeholder="Username" value={username} onChange={e => setUsername(e.target.value)} />
          </div>
          <div className="field">
            <span className="field-label">Password <Help text={HELP.password} /></span>
            <input required placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <button type="submit" disabled={loggingIn}>{loggingIn ? 'Opening...' : 'Open form'}</button>
          {loginError && <p className="status">{loginError}</p>}
        </form>
      )}

      {authed?.kind === 'provider' && (
        <>
          <div className="hero-card">
            <h3>Two ways to add items</h3>
            <p><a href="#one-item">1. Add one item</a> — fill in one item and send it straight away.</p>
            <p><a href="#bulk">2. Add many items at once</a> — build a list and send it all together.</p>
          </div>

          <form onSubmit={submitItem} className="form-card" id="one-item" style={{ scrollMarginTop: 130 }}>
            <h3>1 — Add one item</h3>
            <p className="hint">Fill in the item and tap Submit item. It goes to Yently for approval first, and shows on your store once it is approved. One submit = one item.</p>
            <ItemFields item={item} setItem={setItem} categories={categories} subcats={subcats} storeName={authed.providerName} />
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Submit item'}</button>
            {status && <p className="status">{status}</p>}
          </form>

          <div className="form-card" id="bulk" style={{ scrollMarginTop: 130 }}>
            <h3>2 — Add many items at once</h3>
            <p className="hint">Faster when you have a lot of items. Fill in items one by one — they are kept in a list in this browser, so you can take your time — then send the whole list for approval at once. The list stays saved in this browser even if you close the page and come back.</p>
            <form onSubmit={addBulkItem} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ItemFields item={bulkItem} setItem={setBulkItem} categories={categories} subcats={subcats} storeName={authed.providerName} />
              <div className="field-row" style={{ marginTop: 10 }}>
                <button type="submit">Add an Item</button>
                <Help text={HELP.addBulk} />
              </div>
            </form>
            {batchItems.length > 0 && (
              <div>
                <p><b>Items in this list ({batchItems.length}):</b> <Help text={HELP.batchList} /></p>
                {batchItems.map((it, i) => (
                  <p key={i}>{it.name} — ${it.price} <button type="button" className="btn-mini" onClick={() => setBatchItems(batchItems.filter((_, j) => j !== i))}>Remove</button></p>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
              <span className="field-row">
                <button type="button" onClick={downloadBatch} disabled={batchItems.length === 0}>Download data.json</button>
                <Help text={HELP.download} />
              </span>
              <span className="field-row">
                <label className="btn-soft" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 16px', borderRadius: 10, cursor: 'pointer' }}>
                  Load a data.json file
                  <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={loadBatchFile} />
                </label>
                <Help text={HELP.loadFile} />
              </span>
              <span className="field-row">
                <button type="button" onClick={submitBatch} disabled={batchBusy || batchItems.length === 0}>{batchBusy ? 'Sending...' : 'Upload for approval'}</button>
                <Help text={HELP.uploadBatch} />
              </span>
            </div>
            {batchStatus && <p className="status">{batchStatus}</p>}
          </div>
        </>
      )}
    </div>
  )

}
