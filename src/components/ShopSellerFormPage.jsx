import { useEffect, useRef, useState } from 'react'
import { supabase, NOTIFY_EMAIL } from '../lib/supabaseClient'
import { shrinkImage, removeStorePictureUrl } from '../lib/storeUpload'
import { loadItemCategories, loadSubCategories, loadItems, loadItemSubcategoryIds, loadProviders } from '../lib/storeData'
import { AdminVariantMatrix } from './StoreBits'
import { fmtNum } from './CarSection'
import { GroceryTopBar } from './GroceryMenu'

// ---------------------------------------------------------------------------
// Seller form for Shop (mirrors the Cars seller form).
// In Shop, every seller IS a store — even one person selling one item,
// or a stay-home mum selling home-made food. A seller logs in with the
// username + password Yently gave them (stored readable in the DB by
// design, throwaway only — same rule as the Cars seller passes and the
// store provider passes). Then they see their own store's items, add
// one, edit one, or add many at once from a list file. Every item lands
// pending for approval and only shows in the Shop after the admin
// approves it — unless the seller's Direct Upload switch is on, in
// which case it goes live straight away (the admin still sees it in
// Admin → menu 1 → Shop → Stores → Manage → Items).
// Pictures go to the same product-images bucket the shop uses, under
// items/<store-slug>/, shrunk in the browser first (max 1600px).
// The username is never saved on the device: no restore, and any name
// an older version saved is cleared the first time this page opens.
// ---------------------------------------------------------------------------

const blankItem = () => ({
  category_id: '', name: '', price: '', description: '',
  delivery_address: '', pickup_address: '',
  delivery: true, pickup: true, stock: '', barCode: '', pics: [], subcategoryIds: [],
})

async function uploadShopItemPictures(files, slug) {
  const urls = []
  for (const file of files) {
    const up = await shrinkImage(file)
    const safe = up.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `items/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`
    const { error } = await supabase.storage.from('product-images').upload(path, up)
    if (error) throw error
    const { data } = supabase.storage.from('product-images').getPublicUrl(path)
    urls.push(data.publicUrl)
  }
  return urls
}

const SAMPLE_LIST = [
  {
    category_id: '', name: 'Home-made Strawberry Jam 500g', price: 6.50,
    description: 'Home-made jam, made with fresh strawberries and a little sugar.',
    delivery_address: '', pickup_address: '', delivery: true, pickup: true,
    stock: 12, barCode: '', pics: [], subcategoryIds: [],
  },
]

// Plain, detailed explanations for every field — shown when the
// seller taps the "?" next to a label, so nobody has to guess how to
// fill the form in.
const HELP = {
  store: 'This is already filled in for you — it is your store\'s name, from Yently. You cannot change it here. If it shows the wrong store, stop and contact Yently.',
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
  download: 'Saves your list as a file on your phone or computer — a copy to keep, or to send to someone else to finish.',
  downloadSample: 'Saves an example list on your phone or computer — one item, filled in, so you can see how a list looks. Change it to your own items, then load it back here.',
  loadFile: 'Loads a list from a list file — for example one you downloaded before, or one someone made for you. It replaces the list you have now.',
  uploadBatch: 'Sends the whole list to Yently at once. The items show on your store once they are approved — or straight away if your Direct Upload is on.',
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

// Picture picker for one item: uploads straight away to the
// product-images bucket under items/<store-slug>/, shrunk in the
// browser first. Same look as the store form's picture field.
function ShopPicField({ pics, setPics, slug }) {
  const [uploading, setUploading] = useState(false)

  const upload = async (e) => {
    const files = [...(e.target.files || [])]
    if (!files.length) return
    setUploading(true)
    try {
      const urls = await uploadShopItemPictures(files, slug)
      setPics([...pics, ...urls])
    } catch (err) {
      alert('Upload failed: ' + err.message)
    }
    setUploading(false)
  }

  return (
    <div>
      <label className="upload-btn">
        {uploading ? 'Uploading...' : '📷 Upload pictures'}
        <input type="file" accept="image/*" multiple hidden onChange={upload} disabled={uploading} />
      </label>
      {pics.length > 0 && (
        <div className="pic-list">
          {pics.map((u, i) => (
            <span key={i}>{u.split('/').pop()}
              <button type="button" className="btn-mini" onClick={() => { removeStorePictureUrl(u); setPics(pics.filter((_, j) => j !== i)) }}>✕</button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// The item fields, shared by the single-item form and the list form
// so both stay identical. Defined at module level (not inside the
// page) so typing never loses focus or closes an open help.
function ItemFields({ item, setItem, categories, subcats, storeName, slug }) {
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
          : <AdminVariantMatrix rows={visibleSubcats} selectedIds={item.subcategoryIds || []} onChange={ids => set({ subcategoryIds: ids })} />}
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
        <ShopPicField pics={item.pics} setPics={pics => set({ pics })} slug={slug} />
      </div>
    </>
  )
}

function ItemForm({ seller, creds, categories, subcats, initial, onDone, onCancel }) {
  const [form, setForm] = useState(initial || blankItem())
  const [status, setStatus] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setStatus('Sending...')
    try {
      const args = {
        p_slug: seller.slug,
        p_username: creds.username,
        p_password: creds.password,
        p_category_ids: [Number(form.category_id)],
        p_subcategory_ids: form.subcategoryIds || [],
        p_name: form.name.trim(),
        p_price: Number(form.price),
        p_description: form.description.trim() || null,
        p_delivery_address: form.delivery_address.trim() || null,
        p_pickup_address: form.pickup_address.trim() || null,
        p_delivery: form.delivery,
        p_pickup: form.pickup,
        p_stock: form.stock === '' ? null : Number(form.stock),
        p_pics: form.pics || [],
        p_barCode: (form.barCode || '').trim() || null,
      }
      if (initial && initial.id) {
        await supabase.rpc('update_provider_item', { ...args, p_id: initial.id })
        setStatus('✓ Saved — your item is back to waiting for approval, Yently will approve it again before it shows — or straight away if your Direct Upload is on.')
      } else {
        const { data, error } = await supabase.rpc('submit_provider_item', args)
        if (error) throw error
        setStatus(`✓ Item sent (id ${data.item_id}). It will show in the Shop once Yently approves it — or straight away if your Direct Upload is on.`)
        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              to: NOTIFY_EMAIL,
              subject: `New shop seller item — ${seller.name}`,
              table: 'store_items',
              record: { store: seller.name, ...form, item_id: data.item_id },
            },
          })
        } catch {
          setStatus(s => s + ' (Note: the item is saved, but the owner email failed.)')
        }
      }
      onDone()
    } catch (err) {
      setStatus('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="form-card wide" onSubmit={handleSubmit}>
      <h3>{initial && initial.id ? `Edit — ${initial.name}` : 'Add an item'}</h3>
      <ItemFields item={form} setItem={setForm} categories={categories} subcats={subcats} storeName={seller.name} slug={seller.slug} />
      <div className="row">
        <button type="submit" disabled={saving}>{initial && initial.id ? 'Save changes' : 'Send item'}</button>
        {onCancel && <button type="button" onClick={onCancel}>Cancel</button>}
      </div>
      {status && <p className="status">{status}</p>}
    </form>
  )
}

export default function ShopSellerFormPage({ go }) {
  const [creds, setCreds] = useState({ username: '', password: '' })
  const [seller, setSeller] = useState(null)
  const [loginMsg, setLoginMsg] = useState('')
  const [loggingIn, setLoggingIn] = useState(false)
  const [categories, setCategories] = useState([])
  const [subcats, setSubcats] = useState([])
  const [items, setItems] = useState(null)
  const [itemsMsg, setItemsMsg] = useState('')
  const [editing, setEditing] = useState(null)
  const [showAdd, setShowAdd] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [bulkItem, setBulkItem] = useState(blankItem)
  const [batch, setBatch] = useState([])
  const [batchMsg, setBatchMsg] = useState('')
  const [uploadingBatch, setUploadingBatch] = useState(false)

  // The username is never saved on the device: no restore, and any
  // name an older version saved is cleared the first time this page
  // opens, so the field always starts empty.
  useEffect(() => {
    try { localStorage.removeItem('yently-shop-seller-username') } catch {}
    loadItemCategories().then(setCategories).catch(() => {})
    loadSubCategories().then(setSubcats).catch(() => {})
  }, [])

  // The list is kept in this browser so the seller can take their
  // time — it stays saved even if they close the page and come back.
  // It is loaded at login (below) so the save below never overwrites
  // it with an empty list on the first render after logging in.
  useEffect(() => {
    if (!seller) return
    try { localStorage.setItem('autofly-batch-' + seller.slug, JSON.stringify(batch)) } catch {}
  }, [batch, seller])

  const loadItemsFor = async (s) => {
    try {
      const data = await loadItems({ providerId: s.providerId, activeOnly: false })
      setItems(data || [])
    } catch (err) {
      setItemsMsg('Error: ' + err.message)
      setItems([])
    }
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoggingIn(true)
    setLoginMsg('Checking...')
    try {
      const { data, error } = await supabase.rpc('check_shop_seller', { p_username: creds.username.trim(), p_password: creds.password })
      if (error) throw error
      if (!data || data.length === 0) {
        setLoginMsg('Wrong username or password for this store.')
        return
      }
      const s = data[0]
      // The store's provider id is what the items list needs. The
      // login answer carries it when the DB side returns it; otherwise
      // fall back to the public stores list, matched on the store name.
      let providerId = s.provider_id || null
      if (!providerId) {
        const providers = await loadProviders()
        const match = (providers || []).find(p => p.name === s.name)
        providerId = match ? match.id : null
      }
      if (!providerId) {
        setLoginMsg('Your store was found, but its items could not be loaded — please contact Yently.')
        return
      }
      const c = { username: creds.username.trim(), password: creds.password }
      setSeller({ ...s, providerId })
      setLoginMsg('')
      // Restore the seller's saved list now, in the same login step,
      // so the save effect above never sees an empty list first.
      try {
        const saved = JSON.parse(localStorage.getItem('autofly-batch-' + s.slug) || '[]')
        if (Array.isArray(saved)) setBatch(saved)
      } catch {}
      loadItemsFor({ ...s, providerId })
    } catch (err) {
      setLoginMsg('Error: ' + err.message)
    } finally {
      setLoggingIn(false)
    }
  }

  const signOut = () => {
    setSeller(null)
    setCreds({ username: '', password: '' })
    setItems(null)
    setEditing(null)
    setShowAdd(false)
    setBatch([])
  }

  const startEdit = async (item) => {
    setShowAdd(false)
    let subcategoryIds = []
    try { subcategoryIds = await loadItemSubcategoryIds(item.id) } catch {}
    setEditing({
      id: item.id,
      category_id: item.categories && item.categories.length > 0 ? item.categories[0].id : '',
      subcategoryIds,
      name: item.name || '',
      price: item.price ?? '',
      description: item.description || '',
      delivery_address: item.delivery_address || '',
      pickup_address: item.pickup_address || '',
      delivery: item.delivery !== false,
      pickup: item.pickup !== false,
      stock: item.stock === null || item.stock === undefined ? '' : item.stock,
      barCode: item.barCode || '',
      pics: item.pics || [],
    })
  }

  const deleteItem = async (item) => {
    if (confirmDelete !== item.id) { setConfirmDelete(item.id); return }
    setConfirmDelete(null)
    const { error } = await supabase.rpc('delete_provider_item', { p_username: creds.username, p_password: creds.password, p_id: item.id })
    if (error) { setItemsMsg('Error: ' + error.message); return }
    setItemsMsg(`Deleted ${item.name}.`)
    loadItemsFor(seller)
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
    setBatch([...batch, normalizeBulkItem(bulkItem)])
    setBulkItem(blankItem())
    setBatchMsg(`Added — ${batch.length + 1} item${batch.length === 0 ? '' : 's'} in the list.`)
  }

  const downloadSample = () => {
    const blob = new Blob([JSON.stringify(SAMPLE_LIST, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-items.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadBatch = () => {
    const blob = new Blob([JSON.stringify(batch, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-items.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const loadBatchFile = async (file) => {
    setBatchMsg('')
    try {
      const parsed = JSON.parse(await file.text())
      if (!Array.isArray(parsed)) { setBatchMsg('That file is not a list — a list file holds a list of items in [square brackets].'); return }
      const items = parsed.map(normalizeBulkItem)
      for (const it of items) {
        if (!it.name) throw new Error('Every item in the file needs a name.')
        if (!(it.price >= 0)) throw new Error(`Item "${it.name}" needs a price.`)
      }
      setBatch(items)
      setBatchMsg(`Loaded ${items.length} item${items.length === 1 ? '' : 's'} from ${file.name} — this replaced the list.`)
    } catch (err) {
      if (err.message && err.message.startsWith('Every item')) {
        setBatchMsg('Could not load that file: ' + err.message)
      } else if (err.message && err.message.includes('needs a price')) {
        setBatchMsg('Could not load that file: ' + err.message)
      } else {
        setBatchMsg('Could not read that file — it must be a list file with a list of items.')
      }
    }
  }

  const uploadBatch = async () => {
    if (batch.length === 0) { setBatchMsg('Add at least one item first.'); return }
    setUploadingBatch(true)
    setBatchMsg('Sending the list...')
    try {
      const { data, error } = await supabase.rpc('submit_store_item_batch', {
        p_slug: seller.slug, p_username: creds.username, p_password: creds.password, p_items: batch,
      })
      if (error) throw error
      setBatch([])
      setBatchMsg(`✓ Sent ${data.items} item${data.items === 1 ? '' : 's'} (list #${data.batch_id}). They will show in the Shop once Yently approves them — or straight away if your Direct Upload is on.`)
      try {
        await supabase.functions.invoke('send-notification', {
          body: {
            to: NOTIFY_EMAIL,
            subject: `Shop seller items list — ${seller.name}`,
            table: 'store_item_batches',
            record: { store: seller.name, items: data.items, batch_id: data.batch_id },
          },
        })
      } catch {
        setBatchMsg(s => s + ' (Note: the list is saved, but the owner email failed.)')
      }
      loadItemsFor(seller)
    } catch (err) {
      setBatchMsg('Error: ' + err.message)
    } finally {
      setUploadingBatch(false)
    }
  }

  if (!seller) {
    return (
      <div>
        <GroceryTopBar go={go} />
        <div className="hero-card">
          <h2>Sell your items on Yently</h2>
          <p>Log in with the username and password Yently gave you, then add your items — one at a time, or many at once from a list file. Every item is checked by Yently before it shows in the Shop.</p>
        </div>
        <form className="form-card wide" onSubmit={handleLogin} autoComplete="off">
          <input required placeholder="Username" autoComplete="off" value={creds.username} onChange={e => setCreds({ ...creds, username: e.target.value })} />
          <input required placeholder="Password" type="password" autoComplete="current-password" value={creds.password} onChange={e => setCreds({ ...creds, password: e.target.value })} />
          <button type="submit" disabled={loggingIn}>{loggingIn ? 'Checking...' : 'Log in'}</button>
          {loginMsg && <p className="status">{loginMsg}</p>}
          <p className="hint">Don't have a username yet? Ask Yently for one — the admin creates it in Admin → menu 1 → Shop → Stores.</p>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button type="button" onClick={() => go('shop-seller-soon')} style={{ background: '#f5c542', color: '#161d44', fontWeight: 700 }}>Become a Yently Shop Seller</button>
            <p className="hint">Seller logins open soon — tap to see what's coming.</p>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div>
      <GroceryTopBar go={go} />
      <div className="hero-card">
        <h2>Your items — {seller.name}</h2>
        <p>Your items are below. "Live" means customers can see it in the Shop; "Waiting for approval" means Yently is still checking it. Editing an item sends it back for approval — unless your Direct Upload is on, then it stays live.</p>
        <button type="button" onClick={signOut}>Sign out</button>
      </div>

      {itemsMsg && <p className="status">{itemsMsg}</p>}
      {items === null && <div className="hero-card"><p>Loading your items...</p></div>}
      {items !== null && items.length === 0 && <p className="hint">No items yet — add your first one below.</p>}
      {items !== null && items.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Item</th><th>Price</th><th>Status</th><th className="no-print"></th></tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.price !== null && item.price !== undefined && item.price !== '' ? `$${fmtNum(item.price)}` : ''}</td>
                  <td>{item.is_active ? 'Live' : 'Waiting for approval'}</td>
                  <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                    <button type="button" className="btn-mini" onClick={() => startEdit(item)}>Edit</button>{' '}
                    <button
                      type="button"
                      className="btn-mini btn-danger"
                      onClick={() => deleteItem(item)}
                    >
                      {confirmDelete === item.id ? 'Tap again to confirm' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing ? (
        <ItemForm
          seller={seller}
          creds={creds}
          categories={categories}
          subcats={subcats}
          initial={editing}
          onDone={() => { setEditing(null); loadItemsFor(seller) }}
          onCancel={() => setEditing(null)}
        />
      ) : showAdd ? (
        <ItemForm seller={seller} creds={creds} categories={categories} subcats={subcats} onDone={() => { setShowAdd(false); loadItemsFor(seller) }} onCancel={() => setShowAdd(false)} />
      ) : (
        <button onClick={() => setShowAdd(true)} style={{ marginBottom: 16 }}>+ Add an item</button>
      )}

      <div className="form-card wide">
        <h3>Add many items at once (from a list)</h3>
        <p className="hint">Faster when you have a lot of items. Fill in items one by one — they are kept in a list in this browser, so you can take your time — then send the whole list at once. The list stays saved in this browser even if you close the page and come back.</p>
        <form onSubmit={addBulkItem} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <ItemFields item={bulkItem} setItem={setBulkItem} categories={categories} subcats={subcats} storeName={seller.name} slug={seller.slug} />
          {batch.length > 0 && (
            <div>
              <p><b>Items in this list ({batch.length}):</b> <Help text={HELP.batchList} /></p>
              {batch.map((it, i) => (
                <p key={i}>{it.name} — ${fmtNum(it.price)} <button type="button" className="btn-mini" onClick={() => setBatch(batch.filter((_, j) => j !== i))}>Remove</button></p>
              ))}
            </div>
          )}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 12, background: '#f9fafb', marginTop: 10 }}>
            <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: 14 }}>List actions</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="field-row">
                <button type="submit">Add an Item</button>
                <Help text={HELP.addBulk} />
              </span>
              <span className="field-row">
                <button type="button" onClick={downloadSample}>Download an example list</button>
                <Help text={HELP.downloadSample} />
              </span>
              <span className="field-row">
                <button type="button" onClick={downloadBatch} disabled={batch.length === 0}>Download my list</button>
                <Help text={HELP.download} />
              </span>
              <span className="field-row">
                <label className="btn-soft" style={{ display: 'inline-flex', alignItems: 'center', padding: '10px 16px', borderRadius: 10, cursor: 'pointer' }}>
                  Load a list file
                  <input type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={e => { const f = e.target.files && e.target.files[0]; if (f) loadBatchFile(f); e.target.value = '' }} />
                </label>
                <Help text={HELP.loadFile} />
              </span>
              <span className="field-row">
                <button type="button" onClick={uploadBatch} disabled={uploadingBatch || batch.length === 0}>{uploadingBatch ? 'Sending...' : `Upload ${batch.length} item(s)`}</button>
                <Help text={HELP.uploadBatch} />
              </span>
            </div>
          </div>
        </form>
        {batchMsg && <p className="status">{batchMsg}</p>}
      </div>
    </div>
  )
}
